// Local-only integration harness. Excluded from the production Docker context.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/e2e/fixtures/smtpcapture"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/router"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

func main() {
	web := flag.String("web", "web/dist", "production frontend directory")
	emailLab := flag.Bool("email-lab", false, "enable loopback SMTP capture and email fixtures")
	flag.Parse()
	if os.Getenv("INVITE_LAB") != "1" || os.Getenv("SQL_DSN") != "" || os.Getenv("LOG_SQL_DSN") != "" {
		log.Fatal("Local lab requires INVITE_LAB=1 and no database DSNs")
	}
	dir, err := os.MkdirTemp("", "94api-invite-lab-")
	must(err)
	common.SQLitePath = filepath.Join(dir, "lab.db")
	common.SessionSecret = "invite-lab-session-secret-not-production"
	common.IsMasterNode = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.CriticalRateLimitEnable = false
	common.GlobalApiRateLimitEnable = false
	must(model.InitDB())
	must(model.InitLogDB())
	model.InitOptionMap()
	must(model.InitializeInviteHistory())
	must(authz.Init(model.DB))
	must(i18n.Init())
	setting.StripeWebhookSecret = "invite-lab-webhook-secret"
	setting.StripeApiSecret = "sk_test_invite_lab"
	setting.StripePriceId = "price_lab"
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), middleware.RequestId(), middleware.I18n())
	router.SetApiRouter(r)
	if *emailLab {
		installEmailLabCaptcha(r)
		smtp, err := smtpcapture.Start()
		must(err)
		defer smtp.Close()
		common.SMTPServer, common.SMTPPort, common.SMTPFrom = smtp.Host, smtp.Port, "94api@lab.test"
		constant.NotifyLimitCount, constant.NotificationLimitDurationMinute = 10, 10
		r.GET("/lab/emails", func(c *gin.Context) { c.JSON(200, smtp.Messages()) })
		r.POST("/lab/email/fail-next", func(c *gin.Context) {
			smtp.RejectNextMessage()
			c.JSON(200, gin.H{"success": true})
		})
		r.POST("/lab/email/expiry", func(c *gin.Context) {
			common.VerificationValidMinutes = 10
			if c.Query("expired") == "true" {
				common.VerificationValidMinutes = 0
			}
			c.JSON(200, gin.H{"success": true})
		})
		r.POST("/lab/email/notify", func(c *gin.Context) {
			var input struct {
				UserID int            `json:"user_id"`
				Kind   string         `json:"kind"`
				Data   map[string]any `json:"data"`
			}
			if c.ShouldBindJSON(&input) != nil {
				c.Status(400)
				return
			}
			var user model.User
			if err := model.DB.First(&user, input.UserID).Error; err != nil {
				c.Status(404)
				return
			}
			notice := dto.NewNotify(input.Kind, "LAB legacy", "LAB legacy", nil)
			notice.EmailTemplate, notice.EmailData = input.Kind, input.Data
			err := service.NotifyUser(user.Id, user.Email, user.GetSetting(), notice)
			c.JSON(200, gin.H{"success": err == nil})
		})
	}
	// Fixtures and clock advancement exist only in this loopback lab executable.
	r.POST("/lab/payment", func(c *gin.Context) {
		var input struct {
			UserID  int    `json:"user_id"`
			TradeNo string `json:"trade_no"`
			Amount  int    `json:"amount"`
		}
		if c.ShouldBindJSON(&input) != nil || input.Amount <= 0 {
			c.Status(400)
			return
		}
		must(model.DB.Create(&model.TopUp{UserId: input.UserID, TradeNo: input.TradeNo, Amount: int64(input.Amount), Money: float64(input.Amount), PaymentProvider: model.PaymentProviderStripe, PaymentMethod: model.PaymentMethodStripe, Status: common.TopUpStatusPending}).Error)
		c.JSON(200, gin.H{"success": true})
	})
	r.POST("/lab/release", func(c *gin.Context) {
		var input struct {
			Hours int64 `json:"hours"`
		}
		if c.ShouldBindJSON(&input) != nil {
			c.Status(400)
			return
		}
		err := model.ReleaseInviteRewards(common.GetTimestamp() + input.Hours*3600)
		c.JSON(200, gin.H{"success": err == nil})
	})
	r.GET("/lab/user/:name", func(c *gin.Context) {
		var u model.User
		err := model.DB.Where("username = ?", c.Param("name")).First(&u).Error
		c.JSON(200, gin.H{"success": err == nil, "data": gin.H{"id": u.Id, "quota": u.Quota, "aff_quota": u.AffQuota, "inviter_id": u.InviterId, "code": u.AffCode}})
	})
	root, err := filepath.Abs(*web)
	must(err)
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Status(404)
			return
		}
		target := filepath.Join(root, filepath.Clean("/"+c.Request.URL.Path))
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			c.File(target)
			return
		}
		c.File(filepath.Join(root, "index.html"))
	})
	fmt.Printf("INVITE_LAB_URL=http://127.0.0.1:%d\n", *common.Port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("127.0.0.1:%d", *common.Port), r))
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
