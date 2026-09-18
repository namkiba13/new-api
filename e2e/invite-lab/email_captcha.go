package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// Only the external Cloudflare boundary is simulated; production middleware
// still checks the request token and consumes each issued LAB token once.
type emailLabCaptcha struct {
	http.RoundTripper
	tokens sync.Map
}

func (lab *emailLabCaptcha) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.Host != "challenges.cloudflare.com" || request.URL.Path != "/turnstile/v0/siteverify" {
		return lab.RoundTripper.RoundTrip(request)
	}
	if err := request.ParseForm(); err != nil {
		return nil, err
	}
	_, issued := lab.tokens.LoadAndDelete(request.Form.Get("response"))
	success := issued && request.Form.Get("secret") == "email-lab-secret"
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(fmt.Sprintf(`{"success":%t}`, success)))}, nil
}

func installEmailLabCaptcha(router *gin.Engine) {
	lab := &emailLabCaptcha{RoundTripper: http.DefaultTransport}
	http.DefaultTransport = lab
	common.TurnstileSiteKey, common.TurnstileSecretKey = "email-lab-site-key", "email-lab-secret"
	router.GET("/lab/captcha", func(c *gin.Context) {
		token := common.GenerateVerificationCode(0)
		lab.tokens.Store(token, true)
		c.JSON(http.StatusOK, gin.H{"success": true, "data": token})
	})
}
