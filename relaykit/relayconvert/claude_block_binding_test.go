package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeThinkingBlockBindingSurvivesNativeRelay(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "adaptive thinking on a known model",
			body: `{"model":"claude-opus-5-5","max_tokens":4096,"output_config":{"effort":"high"},"thinking":{"type":"adaptive","block_binding":{"prefix_mismatch_behavior":"drop_block"}},"messages":[{"role":"user","content":"hi"}]}`,
		},
		{
			name: "manual thinking on a known model",
			body: `{"model":"claude-sonnet-4-5","max_tokens":4096,"thinking":{"type":"enabled","budget_tokens":2048,"block_binding":{"prefix_mismatch_behavior":"drop_block"}},"messages":[{"role":"user","content":"hi"}]}`,
		},
		{
			name: "unknown Claude-compatible model",
			body: `{"model":"claude-test","max_tokens":4096,"thinking":{"type":"enabled","budget_tokens":2048,"block_binding":{"prefix_mismatch_behavior":"drop_block"}},"messages":[{"role":"user","content":"hi"}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request dto.ClaudeRequest
			require.NoError(t, kitutil.Unmarshal([]byte(tt.body), &request))
			require.NoError(t, ApplyClaudeThinkingModel(&request, &convmeta.Values{}))

			encoded, err := kitutil.Marshal(request)
			require.NoError(t, err)
			var upstream struct {
				Thinking struct {
					BlockBinding map[string]string `json:"block_binding"`
				} `json:"thinking"`
			}
			require.NoError(t, kitutil.Unmarshal(encoded, &upstream))
			assert.Equal(t, map[string]string{"prefix_mismatch_behavior": "drop_block"}, upstream.Thinking.BlockBinding)
		})
	}
}
