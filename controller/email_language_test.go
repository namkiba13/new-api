package controller

import (
	"context"
	"fmt"
	"html"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/e2e/fixtures/smtpcapture"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupEmailControllerSMTP(t *testing.T) *smtpcapture.Server {
	t.Helper()
	smtp, err := smtpcapture.Start()
	require.NoError(t, err)
	oldHost, oldPort, oldFrom, oldAccount := common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount
	oldSSL, oldTLS := common.SMTPSSLEnabled, common.SMTPStartTLSEnabled
	oldDomain, oldAlias, oldMinutes := common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled, common.VerificationValidMinutes
	oldAddress := system_setting.ServerAddress
	common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount = smtp.Host, smtp.Port, "lab@example.test", ""
	common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = false, false
	common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled = false, false
	system_setting.ServerAddress = "https://94api.dev"
	t.Cleanup(func() {
		_ = smtp.Close()
		common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount = oldHost, oldPort, oldFrom, oldAccount
		common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = oldSSL, oldTLS
		common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled, common.VerificationValidMinutes = oldDomain, oldAlias, oldMinutes
		system_setting.ServerAddress = oldAddress
	})
	return smtp
}

func TestLocalizedAccountEmailHandlers(t *testing.T) {
	db := setupManageUserTestDB(t)
	smtp := setupEmailControllerSMTP(t)
	validMinutes := common.VerificationValidMinutes
	for index, lang := range i18n.SupportedLanguages() {
		t.Run(lang, func(t *testing.T) {
			email := fmt.Sprintf("lab+%d@example.test", index)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/verification?email="+url.QueryEscape(email), nil)
			c.Request.Header.Set("Accept-Language", lang)
			SendEmailVerification(c)
			require.Contains(t, recorder.Body.String(), `"success":true`)
			message := <-smtp.Received
			require.Equal(t, email, message.To)
			assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			codeMatch := regexp.MustCompile(`<strong>([0-9a-f]{6})</strong>`).FindStringSubmatch(message.HTML)
			require.Len(t, codeMatch, 2)
			code := codeMatch[1]
			assert.True(t, common.VerifyCodeWithKey(email, code, common.EmailVerificationPurpose))
			assert.False(t, common.VerifyCodeWithKey(email, "wrong", common.EmailVerificationPurpose))
			user := model.User{Id: 81000 + index, Username: fmt.Sprint("email-", index), AffCode: fmt.Sprint("ec", index), Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&user).Error)
			body, err := common.Marshal(map[string]string{"email": email, "code": code})
			require.NoError(t, err)
			recorder = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(recorder)
			c.Set("id", user.Id)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/oauth/email/bind", strings.NewReader(string(body)))
			EmailBind(c)
			require.Contains(t, recorder.Body.String(), `"success":true`)
			recorder = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape(email), nil)
			c.Request.Header.Set("Accept-Language", lang)
			SendPasswordResetEmail(c)
			require.Contains(t, recorder.Body.String(), `"success":true`)
			message = <-smtp.Received
			assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			linkMatch := regexp.MustCompile(`href="([^"]+)"`).FindStringSubmatch(message.HTML)
			require.Len(t, linkMatch, 2)
			link, err := url.Parse(html.UnescapeString(linkMatch[1]))
			require.NoError(t, err)
			assert.Equal(t, email, link.Query().Get("email"), "plus aliases must survive the link")
			token := link.Query().Get("token")
			common.VerificationValidMinutes = 0
			assert.False(t, common.VerifyCodeWithKey(email, token, common.PasswordResetPurpose))
			common.VerificationValidMinutes = validMinutes
			body, err = common.Marshal(PasswordResetRequest{Email: email, Token: token})
			require.NoError(t, err)
			recorder = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/user/reset", strings.NewReader(string(body)))
			ResetPassword(c)
			var result struct {
				Success bool   `json:"success"`
				Data    string `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			require.True(t, result.Success, recorder.Body.String())
			require.NoError(t, db.First(&user, user.Id).Error)
			assert.True(t, common.ValidatePasswordAndHash(result.Data, user.Password))
			assert.False(t, common.VerifyCodeWithKey(email, token, common.PasswordResetPurpose), "reset token must be consumed")
			common.DeleteKey(email, common.EmailVerificationPurpose)
		})
	}
	before := len(smtp.Messages())
	for _, email := range []string{"not-an-email", "missing@example.test"} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email="+url.QueryEscape(email), nil)
		SendPasswordResetEmail(c)
		assert.Len(t, smtp.Messages(), before)
	}
	require.NoError(t, smtp.Close())
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/reset_password?email=lab%2B0%40example.test", nil)
	SendPasswordResetEmail(c)
	assert.Contains(t, recorder.Body.String(), `"success":true`, "SMTP failures must not reveal account existence")
}

func TestLocalizedUpstreamTaskDelivery(t *testing.T) {
	db := setupManageUserTestDB(t)
	smtp := setupEmailControllerSMTP(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	oldLimit, oldDuration, oldInterval, oldMemory := constant.NotifyLimitCount, constant.NotificationLimitDurationMinute, common.RequestInterval, common.MemoryCacheEnabled
	constant.NotifyLimitCount, constant.NotificationLimitDurationMinute, common.RequestInterval, common.MemoryCacheEnabled = 100, 10, 0, false
	channelUpstreamModelUpdateNotifyState.Lock()
	oldTime, oldChanged, oldFailed := channelUpstreamModelUpdateNotifyState.lastNotifiedAt, channelUpstreamModelUpdateNotifyState.lastChangedChannels, channelUpstreamModelUpdateNotifyState.lastFailedChannels
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = 0
	channelUpstreamModelUpdateNotifyState.Unlock()
	t.Cleanup(func() {
		constant.NotifyLimitCount, constant.NotificationLimitDurationMinute, common.RequestInterval, common.MemoryCacheEnabled = oldLimit, oldDuration, oldInterval, oldMemory
		channelUpstreamModelUpdateNotifyState.Lock()
		channelUpstreamModelUpdateNotifyState.lastNotifiedAt, channelUpstreamModelUpdateNotifyState.lastChangedChannels, channelUpstreamModelUpdateNotifyState.lastFailedChannels = oldTime, oldChanged, oldFailed
		channelUpstreamModelUpdateNotifyState.Unlock()
	})
	models := make([]map[string]string, 13)
	for index := range models {
		models[index] = map[string]string{"id": fmt.Sprint("new-model-", index)}
	}
	payload, err := common.Marshal(map[string]any{"data": models})
	require.NoError(t, err)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer upstream.Close()
	for index := 0; index < 9; index++ {
		channel := model.Channel{Id: 92000 + index, Type: constant.ChannelTypeOpenAI, Name: fmt.Sprint("provider-", index), BaseURL: &upstream.URL, Key: "lab-only", Models: "old-model", Status: common.ChannelStatusEnabled}
		channel.SetOtherSettings(dto.ChannelOtherSettings{UpstreamModelUpdateCheckEnabled: true})
		require.NoError(t, db.Create(&channel).Error)
	}
	for index, lang := range i18n.SupportedLanguages() {
		user := model.User{Id: 91000 + index, Username: "upstream-" + lang, AffCode: fmt.Sprint("ut", index), Email: lang + "@upstream.test", Role: common.RoleAdminUser, Status: common.UserStatusEnabled}
		user.SetSetting(dto.UserSetting{Language: lang, UpstreamModelUpdateNotifyEnabled: true})
		require.NoError(t, db.Create(&user).Error)
	}
	summary := runChannelUpstreamModelUpdateTaskOnce(context.Background(), true, false, nil)
	assert.Equal(t, 9, summary.CheckedChannels)
	assert.Equal(t, 9, summary.ChangedChannels)
	assert.Equal(t, 117, summary.DetectedAddModels)
	assert.Equal(t, 9, summary.DetectedRemoveModels)
	require.Len(t, smtp.Messages(), 7)
	for _, message := range smtp.Messages() {
		lang, _, _ := strings.Cut(message.To, "@")
		assert.Contains(t, message.HTML, `lang="`+lang+`"`)
		assert.Contains(t, message.HTML, "12/13")
		assert.Contains(t, message.HTML, "provider-7")
		assert.NotContains(t, message.HTML, "provider-8", "preserve the eight-channel detail limit")
		assert.NotContains(t, message.HTML, "{{")
	}
}
