package i18n

import (
	"bytes"
	"fmt"
	htmltemplate "html/template"
	"maps"
	"strings"
	texttemplate "text/template"

	"github.com/QuantumNous/new-api/common"
	goi18n "github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/nicksnyder/go-i18n/v2/i18n/template"
)

const (
	EmailVerification    = "verification"
	EmailPasswordReset   = "password_reset"
	EmailWalletLow       = "wallet_low"
	EmailSubscriptionLow = "subscription_low"
	EmailChannelDisabled = "channel_disabled"
	EmailChannelEnabled  = "channel_enabled"
	EmailChannelTest     = "channel_test"
	EmailUpstreamUpdate  = "upstream_update"
)

// RenderEmail uses the existing translation bundle and HTML's contextual escaping.
// Data is copied because one notification can be rendered for several recipients.
func RenderEmail(lang, kind string, data map[string]any) (string, string, error) {
	if err := Init(); err != nil {
		return "", "", err
	}
	values := map[string]any{"SystemName": common.SystemName}
	maps.Copy(values, data)
	lang = normalizeLang(lang)
	parts := make([]string, 2)
	for index, part := range []string{"subject", "body"} {
		config := &goi18n.LocalizeConfig{MessageID: "email." + kind + "." + part, TemplateParser: &template.IdentityParser{}}
		raw, err := GetLocalizer(lang).Localize(config)
		if err != nil {
			raw, err = GetLocalizer(DefaultLang).Localize(config)
		}
		if err != nil {
			return "", "", fmt.Errorf("email template %s: %w", config.MessageID, err)
		}
		var output bytes.Buffer
		if part == "subject" {
			tmpl, parseErr := texttemplate.New(part).Option("missingkey=error").Parse(raw)
			err = parseErr
			if err == nil {
				err = tmpl.Execute(&output, values)
			}
		} else {
			tmpl, parseErr := htmltemplate.New(part).Option("missingkey=error").Parse(raw)
			err = parseErr
			if err == nil {
				err = tmpl.Execute(&output, values)
			}
		}
		if err != nil {
			return "", "", fmt.Errorf("render email %s: %w", config.MessageID, err)
		}
		parts[index] = output.String()
	}
	// Subjects are single-line text even when a dynamic channel name contains newlines.
	subject := strings.NewReplacer("\r", " ", "\n", " ").Replace(parts[0])
	return subject, `<html lang="` + lang + `"><body style="overflow-wrap:anywhere;word-break:break-word">` + parts[1] + `</body></html>`, nil
}
