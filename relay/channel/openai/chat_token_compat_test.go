package openai

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestChatTokenCompatibility(t *testing.T) {
	for _, tt := range []struct {
		name, model, fields, wantField string
		wantValue                      int64
		wantRole                       string
		keepSampling                   bool
	}{
		{"sol legacy limit", "gpt-6.1-sol", `"max_tokens":64`, "max_completion_tokens", 64, "developer", false},
		{"luna streaming", "gpt-6-luna", `"max_tokens":64,"stream":true,"reasoning_effort":"none"`, "max_completion_tokens", 64, "developer", true},
		{"sol reasoning suffix", "gpt-6-sol-high", `"max_tokens":64`, "max_completion_tokens", 64, "developer", false},
		{"luna reasoning disables sampling", "gpt-6-luna", `"max_tokens":64,"reasoning_effort":"high"`, "max_completion_tokens", 64, "developer", false},
		{"astra", "gpt-6-astra", `"max_tokens":64`, "max_completion_tokens", 64, "developer", false},
		{"dated sol", "gpt-6.1-sol-2026-10-01", `"max_tokens":64`, "max_completion_tokens", 64, "developer", false},
		{"new limit", "gpt-6.1-sol", `"max_completion_tokens":32`, "max_completion_tokens", 32, "developer", false},
		{"both limits", "gpt-6.1-sol", `"max_tokens":64,"max_completion_tokens":32`, "max_completion_tokens", 32, "developer", false},
		{"explicit zero wins", "gpt-6.1-sol", `"max_tokens":64,"max_completion_tokens":0`, "max_completion_tokens", 0, "developer", false},
		{"legacy zero preserved", "gpt-6.1-sol", `"max_tokens":0`, "max_completion_tokens", 0, "developer", false},
		{"no limit", "gpt-6.1-sol", `"stream":false`, "", 0, "developer", false},
		{"GPT5 existing conversion", "gpt-5", `"max_tokens":64`, "max_completion_tokens", 64, "developer", false},
		{"GPT4 unchanged", "gpt-4o", `"max_tokens":64`, "max_tokens", 64, "system", true},
		{"unknown GPT generation unchanged", "gpt-7-sol", `"max_tokens":64`, "max_tokens", 64, "system", true},
		{"unknown named variant unchanged", "gpt-6.1-sol-custom", `"max_tokens":64`, "max_tokens", 64, "system", true},
		{"invalid snapshot unchanged", "gpt-6.1-sol-2026-99-99", `"max_tokens":64`, "max_tokens", 64, "system", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			body := `{"model":"` + tt.model + `","messages":[{"role":"system","content":"Be brief."},{"role":"user","content":"OK"}],"temperature":0.5,"top_p":0.9,"logprobs":true,"top_logprobs":2,` + tt.fields + `}`
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			request, err := helper.GetAndValidateTextRequest(c, relayconstant.RelayModeChatCompletions)
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{
				OriginModelName: tt.model,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeOpenAI, UpstreamModelName: tt.model,
				},
			}
			converted, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)
			encoded, err := common.Marshal(converted)
			require.NoError(t, err)
			for _, field := range []string{"max_tokens", "max_completion_tokens"} {
				value := gjson.GetBytes(encoded, field)
				assert.Equal(t, field == tt.wantField, value.Exists(), field)
				if field == tt.wantField {
					assert.Equal(t, tt.wantValue, value.Int())
				}
			}
			assert.Equal(t, tt.wantRole, gjson.GetBytes(encoded, "messages.0.role").String())
			for _, field := range []string{"temperature", "top_p", "logprobs", "top_logprobs"} {
				assert.Equal(t, tt.keepSampling, gjson.GetBytes(encoded, field).Exists(), field)
			}
			assert.Equal(t, request.IsStream(c.Request), gjson.GetBytes(encoded, "stream").Bool())
			if !strings.HasSuffix(tt.model, "-high") {
				assert.Equal(t, tt.wantRole, request.GetSystemRoleName())
			}
		})
	}
}

func TestChatTokenCompatibilityRejectsInvalidLimits(t *testing.T) {
	for _, fields := range []string{
		`"max_tokens":-1`,
		`"max_completion_tokens":-1`,
		`"max_tokens":18446744073686646784`,
		`"max_tokens":64,"max_completion_tokens":18446744073686646784`,
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(
			`{"model":"gpt-6.1-sol","messages":[{"role":"user","content":"OK"}],`+fields+`}`))
		c.Request.Header.Set("Content-Type", "application/json")
		_, err := helper.GetAndValidateTextRequest(c, relayconstant.RelayModeChatCompletions)
		require.Error(t, err, fields)
	}
}

func TestMappedGPT6ChatTokenCompatibility(t *testing.T) {
	for _, tt := range []struct {
		name, origin, deployment, baseURL, fields, wantField string
		channelType                                          int
		wantValue                                            int64
		wantRole                                             string
		keepSampling                                         bool
	}{
		{"known upstream", "customer-model", "gpt-6.1-sol", "", `"max_tokens":64`, "max_completion_tokens", constant.ChannelTypeAzure, 64, "developer", false},
		{"native Azure deployment", "gpt-6-astra", "production-astra-2", "", `"max_tokens":64`, "max_completion_tokens", constant.ChannelTypeAzure, 64, "developer", false},
		{"OpenAI Azure astra", "gpt-6-astra", "gpt-6-astra-2", "https://escalanxcx.openai.azure.com/openai", `"max_tokens":64`, "max_completion_tokens", constant.ChannelTypeOpenAI, 64, "developer", false},
		{"OpenAI Azure luna streaming", "gpt-6-luna", "gpt-6-luna-2", "https://escalanxcx.openai.azure.com/openai", `"max_tokens":64,"stream":true,"reasoning_effort":"none"`, "max_completion_tokens", constant.ChannelTypeOpenAI, 64, "developer", true},
		{"mapped explicit zero wins", "gpt-6-astra", "gpt-6-astra-2", "https://escalanxcx.openai.azure.com/openai", `"max_tokens":64,"max_completion_tokens":0`, "max_completion_tokens", constant.ChannelTypeOpenAI, 0, "developer", false},
		{"mapped legacy zero", "gpt-6-astra", "gpt-6-astra-2", "https://escalanxcx.openai.azure.com/openai", `"max_tokens":0`, "max_completion_tokens", constant.ChannelTypeOpenAI, 0, "developer", false},
		{"mapped no limit", "gpt-6-astra", "gpt-6-astra-2", "https://escalanxcx.openai.azure.com/openai", `"stream":false`, "", constant.ChannelTypeOpenAI, 0, "developer", false},
		{"mapped reasoning suffix", "gpt-6-luna-high", "gpt-6-luna-2", "https://escalanxcx.openai.azure.com/openai", `"max_tokens":64`, "max_completion_tokens", constant.ChannelTypeOpenAI, 64, "developer", false},
		{"unknown Azure model", "customer-model", "custom-deployment", "", `"max_tokens":64`, "max_tokens", constant.ChannelTypeAzure, 64, "system", true},
		{"non-Azure upstream wins", "gpt-6-astra", "gpt-4o", "https://api.openai.com", `"max_tokens":64`, "max_tokens", constant.ChannelTypeOpenAI, 64, "system", true},
		{"Azure hostname lookalike unchanged", "gpt-6-astra", "custom-deployment", "https://escalanxcx.openai.azure.com.example.org/openai", `"max_tokens":64`, "max_tokens", constant.ChannelTypeOpenAI, 64, "system", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			body := `{"model":"` + tt.origin + `","messages":[{"role":"system","content":"Be brief."},{"role":"user","content":"OK"}],"temperature":0.5,"top_p":0.9,"logprobs":true,"top_logprobs":2,` + tt.fields + `}`
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
			c.Request.Header.Set("Content-Type", "application/json")
			request, err := helper.GetAndValidateTextRequest(c, relayconstant.RelayModeChatCompletions)
			require.NoError(t, err)
			mapping, err := common.Marshal(map[string]string{tt.origin: tt.deployment})
			require.NoError(t, err)
			c.Set("model_mapping", string(mapping))
			info := &relaycommon.RelayInfo{OriginModelName: tt.origin, ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType: tt.channelType, ChannelBaseUrl: tt.baseURL, UpstreamModelName: tt.origin,
			}}
			require.NoError(t, helper.ModelMappedHelper(c, info, request))
			converted, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)
			encoded, err := common.Marshal(converted)
			require.NoError(t, err)
			assert.Equal(t, tt.deployment, info.UpstreamModelName)
			assert.Equal(t, tt.deployment, gjson.GetBytes(encoded, "model").String())
			for _, field := range []string{"max_tokens", "max_completion_tokens"} {
				value := gjson.GetBytes(encoded, field)
				assert.Equal(t, field == tt.wantField, value.Exists(), field)
				if field == tt.wantField {
					assert.Equal(t, tt.wantValue, value.Int())
				}
			}
			assert.Equal(t, tt.wantRole, gjson.GetBytes(encoded, "messages.0.role").String())
			for _, field := range []string{"temperature", "top_p", "logprobs", "top_logprobs"} {
				assert.Equal(t, tt.keepSampling, gjson.GetBytes(encoded, field).Exists(), field)
			}
			assert.Equal(t, request.IsStream(c.Request), gjson.GetBytes(encoded, "stream").Bool())
		})
	}
}
