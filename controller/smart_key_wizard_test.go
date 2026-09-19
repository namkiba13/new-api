package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSmartKeyWizardStatusAndExistingTokenAPI(t *testing.T) {
	configureTokenAutoGroupsTest(t, "5", `["default","vip"]`)
	user := setupTokenAutoGroupsControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}))
	settings := operation_setting.GetTokenSetting()
	original := settings.SmartKeyWizardEnabled
	optionMap := common.OptionMap
	t.Cleanup(func() {
		settings.SmartKeyWizardEnabled = original
		common.OptionMap = optionMap
	})
	common.OptionMap = map[string]string{}
	for _, enabled := range []bool{false, true, false} {
		require.NoError(t, model.UpdateOption("token_setting.smart_key_wizard_enabled", strconv.FormatBool(enabled)))
		var saved model.Option
		require.NoError(t, model.DB.Where(&model.Option{Key: "token_setting.smart_key_wizard_enabled"}).First(&saved).Error)
		assert.Equal(t, strconv.FormatBool(enabled), saved.Value)
		response := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(response)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
		GetStatus(ctx)
		var payload struct {
			Success bool           `json:"success"`
			Data    map[string]any `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
		require.True(t, payload.Success)
		assert.Equal(t, enabled, payload.Data["smart_key_wizard_enabled"])
	}
	for _, invalid := range []string{"", "invalid", "1", "null"} {
		require.Error(t, model.UpdateOption("token_setting.smart_key_wizard_enabled", invalid))
		var saved model.Option
		require.NoError(t, model.DB.Where(&model.Option{Key: "token_setting.smart_key_wizard_enabled"}).First(&saved).Error)
		assert.Equal(t, "false", saved.Value)
		assert.False(t, settings.SmartKeyWizardEnabled)
	}
	// The visibility flag must not become a new restriction on ordinary Auto keys.
	request := baseAutoTokenRequest("existing-auto-contract")
	request["auto_groups"] = []string{"default"}
	ctx, response := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/", request, user.Id)
	AddToken(ctx)
	require.True(t, decodeAPIResponse(t, response).Success)
	var token model.Token
	require.NoError(t, model.DB.Where("user_id = ? AND name = ?", user.Id, "existing-auto-contract").First(&token).Error)
	assert.Equal(t, "auto", token.Group)
	assert.JSONEq(t, `["default"]`, token.AutoGroups)
	getContext, getResponse := newTokenAutoGroupsAuthenticatedContext(t, http.MethodGet, "/api/token/"+strconv.Itoa(token.Id), nil, user.Id)
	getContext.Params = append(getContext.Params, gin.Param{Key: "id", Value: strconv.Itoa(token.Id)})
	GetToken(getContext)
	require.True(t, decodeAPIResponse(t, getResponse).Success)
	assert.Equal(t, common.TokenStatusEnabled, token.Status)
}
