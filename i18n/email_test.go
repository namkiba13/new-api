package i18n

import (
	"fmt"
	"html"
	"testing"
	"unicode/utf8"

	goi18n "github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/nicksnyder/go-i18n/v2/i18n/template"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestEmailLanguageSelection(t *testing.T) {
	require.NoError(t, Init())
	for _, tc := range []struct{ header, want string }{
		{"en-US", "en"}, {"vi-VN", "vi"}, {"fr-FR", "fr"},
		{"ru-RU", "ru"}, {"ja-JP", "ja"}, {"zhCN", "zh-CN"},
		{"zhTW", "zh-TW"}, {"zh-Hant-HK", "zh-TW"}, {"zh-Hans", "zh-CN"},
		{"de, vi;q=0.8, en;q=0.5", "vi"}, {"en;q=0.5, fr;q=0.9", "fr"},
		{"vi;q=0, en;q=1", "en"}, {"", "en"}, {"invalid!", "en"},
	} {
		t.Run(tc.header, func(t *testing.T) { assert.Equal(t, tc.want, ParseAcceptLanguage(tc.header)) })
	}
	assert.False(t, IsSupported("not-a-language"))
	assert.Equal(t, "Invalid parameters", Translate("vi", "common.invalid_params"))
}

func TestEmailCatalogsAndRendering(t *testing.T) {
	require.NoError(t, Init())
	kinds := []string{EmailVerification, EmailPasswordReset, EmailWalletLow, EmailSubscriptionLow, EmailChannelDisabled, EmailChannelEnabled, EmailChannelTest, EmailUpstreamUpdate}
	data := map[string]any{
		"Code": "ab19cd", "Minutes": 10, "Link": "https://94api.dev/user/reset?email=a%2Bb%40example.test&token=abc",
		"Amount": "$1.23", "Name": "Kênh <script>alert(1)</script>", "ID": 123, "Reason": "Failed & retry <b>",
		"Checked": 21, "Changed": 12, "Added": 13, "Removed": 14, "AutoAdded": 15, "Failed": 16,
		"Channels":     []map[string]any{{"ChannelName": "Channel <x>", "AddCount": 2, "RemoveCount": 1}},
		"ChannelCount": 12, "ChannelOmitted": 11, "AddedModels": []string{"model-<a>"}, "AddedCount": 13, "AddedOmitted": 12,
		"RemovedModels": []string{"model-<b>"}, "RemovedCount": 14, "RemovedOmitted": 13, "FailedIDs": []int{123}, "FailedOmitted": 15,
	}
	for _, lang := range SupportedLanguages() {
		raw, err := localeFS.ReadFile("locales/email." + lang + ".yaml")
		require.NoError(t, err)
		var catalog map[string]string
		require.NoError(t, yaml.Unmarshal(raw, &catalog))
		require.Len(t, catalog, 16, "all eight subjects and bodies must be translated")
		for _, kind := range kinds {
			t.Run(lang+"/"+kind, func(t *testing.T) {
				for _, part := range []string{"subject", "body"} {
					key := "email." + kind + "." + part
					require.NotEmpty(t, catalog[key])
					_, tag, err := GetLocalizer(lang).LocalizeWithTag(&goi18n.LocalizeConfig{MessageID: key, TemplateParser: &template.IdentityParser{}})
					require.NoError(t, err)
					assert.Equal(t, lang, tag.String(), "must use the actual translation, not fallback")
				}
				subject, body, err := RenderEmail(lang, kind, data)
				require.NoError(t, err)
				assert.True(t, utf8.ValidString(subject+body))
				assert.Contains(t, body, fmt.Sprintf(`<html lang="%s">`, lang))
				assert.NotContains(t, subject+body, "{{")
				assert.NotContains(t, subject+body, "<no value>")
				assert.NotContains(t, body, "<script>")
				if kind == EmailVerification {
					assert.Contains(t, body, "<strong>ab19cd</strong>")
					assert.Contains(t, body, "10")
				}
				if kind == EmailPasswordReset {
					assert.Contains(t, html.UnescapeString(body), data["Link"])
				}
				if kind == EmailWalletLow || kind == EmailSubscriptionLow {
					assert.Contains(t, body, "$1.23")
				}
				if kind == EmailUpstreamUpdate {
					assert.Contains(t, body, "Channel &lt;x&gt;")
					assert.Contains(t, body, "model-&lt;a&gt;")
					assert.Contains(t, body, "123")
				}
			})
		}
	}
}

func TestEmailFallbackAndInvalidData(t *testing.T) {
	data := map[string]any{"Code": "123abc", "Minutes": 10}
	enSubject, enBody, err := RenderEmail("en", EmailVerification, data)
	require.NoError(t, err)
	for _, lang := range []string{"", "unknown", "de"} {
		subject, body, err := RenderEmail(lang, EmailVerification, data)
		require.NoError(t, err)
		assert.Equal(t, enSubject, subject)
		assert.Equal(t, enBody, body)
	}
	_, _, err = RenderEmail("vi", EmailVerification, nil)
	require.Error(t, err, "missing codes must never be emailed")
	_, _, err = RenderEmail("vi", "does_not_exist", nil)
	require.Error(t, err, "unknown templates must never be emailed as raw keys")
	subject, body, err := RenderEmail("en", EmailChannelEnabled, map[string]any{"Name": "x\r\nBcc: victim", "ID": 1})
	require.NoError(t, err)
	assert.NotContains(t, subject, "\n")
	assert.NotContains(t, subject, "\r")
	assert.Contains(t, body, "victim")
	assert.NotContains(t, data, "SystemName", "rendering must not mutate shared notification data")
}
