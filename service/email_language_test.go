package service

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/e2e/fixtures/smtpcapture"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestLocalizedNotificationDelivery(t *testing.T) {
	smtp, err := smtpcapture.Start()
	require.NoError(t, err)
	defer smtp.Close()
	oldHost, oldPort, oldFrom, oldAccount := common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount
	oldSSL, oldTLS, oldRedis, oldMemory := common.SMTPSSLEnabled, common.SMTPStartTLSEnabled, common.RedisEnabled, common.MemoryCacheEnabled
	oldLimit, oldDB := constant.NotifyLimitCount, model.DB
	oldDuration := constant.NotificationLimitDurationMinute
	common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount = smtp.Host, smtp.Port, "lab@example.test", ""
	common.SMTPSSLEnabled, common.SMTPStartTLSEnabled, common.RedisEnabled, common.MemoryCacheEnabled = false, false, false, false
	constant.NotifyLimitCount = 1000
	constant.NotificationLimitDurationMinute = 10
	t.Cleanup(func() {
		common.SMTPServer, common.SMTPPort, common.SMTPFrom, common.SMTPAccount = oldHost, oldPort, oldFrom, oldAccount
		common.SMTPSSLEnabled, common.SMTPStartTLSEnabled, common.RedisEnabled, common.MemoryCacheEnabled = oldSSL, oldTLS, oldRedis, oldMemory
		constant.NotifyLimitCount, model.DB = oldLimit, oldDB
		constant.NotificationLimitDurationMinute = oldDuration
		notifyLimitStore.Range(func(key, _ any) bool {
			id, _, _ := strings.Cut(key.(string), ":")
			number, _ := strconv.Atoi(id)
			if number >= 70100 && number <= 75000 {
				notifyLimitStore.Delete(key)
			}
			return true
		})
	})
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	defer sqlDB.Close()
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}))
	root := model.User{Id: 70100, Username: "email-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&root).Error)
	channel := model.Channel{Id: 70200, Name: "LAB <channel>", Key: "lab-key", Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(&channel).Error)
	for index, lang := range i18n.SupportedLanguages() {
		t.Run(lang, func(t *testing.T) {
			email := fmt.Sprintf("%s@example.test", lang)
			setting := dto.UserSetting{Language: lang, NotificationEmail: email, QuotaWarningThreshold: 100}
			info := &relaycommon.RelayInfo{UserId: 71000 + index, UserEmail: "wrong@example.test", UserSetting: setting, UserQuota: 20}
			checkAndSendQuotaNotify(info, 1, 0)
			select {
			case message := <-smtp.Received:
				assert.Equal(t, email, message.To)
				assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			case <-time.After(5 * time.Second):
				t.Fatal("wallet warning was not delivered")
			}
			info.SubscriptionId, info.SubscriptionAmountTotal, info.SubscriptionAmountUsedAfterPreConsume = 1, 500, 490
			checkAndSendSubscriptionQuotaNotify(info)
			select {
			case message := <-smtp.Received:
				assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			case <-time.After(5 * time.Second):
				t.Fatal("subscription warning was not delivered")
			}
			root.Email = email
			root.SetSetting(setting)
			require.NoError(t, db.Save(&root).Error)
			DisableChannel(types.ChannelError{ChannelId: channel.Id, ChannelName: channel.Name, UsingKey: channel.Key, AutoBan: true}, "LAB reason <unsafe>")
			var message smtpcapture.Message
			select {
			case message = <-smtp.Received:
			case <-time.After(5 * time.Second):
				t.Fatal("channel disable notification was not delivered")
			}
			assert.Equal(t, email, message.To)
			assert.Contains(t, message.HTML, "LAB reason &lt;unsafe&gt;")
			assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			EnableChannel(channel.Id, channel.Key, channel.Name)
			select {
			case message = <-smtp.Received:
			case <-time.After(5 * time.Second):
				t.Fatal("channel enable notification was not delivered")
			}
			assert.Contains(t, message.HTML, `lang="`+lang+`"`)
		})
	}

	// Only enabled, opted-in administrators receive the watcher fan-out.
	for index, lang := range i18n.SupportedLanguages() {
		user := model.User{Id: 72000 + index, Username: "watcher-" + lang, AffCode: fmt.Sprint("w", index), Email: lang + "@watcher.test", Role: common.RoleAdminUser, Status: common.UserStatusEnabled}
		user.SetSetting(dto.UserSetting{Language: lang, UpstreamModelUpdateNotifyEnabled: true})
		require.NoError(t, db.Create(&user).Error)
	}
	for index, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleAdminUser} {
		user := model.User{Id: 73000 + index, Username: fmt.Sprint("excluded-", index), AffCode: fmt.Sprint("x", index), Email: "excluded@example.test", Role: role, Status: common.UserStatusEnabled}
		user.SetSetting(dto.UserSetting{Language: "vi", UpstreamModelUpdateNotifyEnabled: index != 1})
		if index == 2 {
			user.Status = common.UserStatusDisabled
		}
		require.NoError(t, db.Create(&user).Error)
	}
	before := len(smtp.Messages())
	notice := dto.NewNotify(dto.NotifyTypeChannelUpdate, "legacy subject", "legacy body", nil)
	notice.EmailTemplate = i18n.EmailChannelTest
	NotifyUpstreamModelUpdateWatchers(notice)
	assert.Len(t, smtp.Messages(), before+7)
	for _, message := range smtp.Messages()[before:] {
		assert.NotEqual(t, "excluded@example.test", message.To)
	}

	// A shared notification can be rendered concurrently without leaking languages.
	var wg sync.WaitGroup
	for index, lang := range i18n.SupportedLanguages() {
		wg.Add(1)
		go func(id int, lang string) {
			defer wg.Done()
			assert.NoError(t, NotifyUser(id, lang+"@parallel.test", dto.UserSetting{Language: lang}, notice))
		}(74000+index, lang)
	}
	wg.Wait()
	assert.Equal(t, "legacy subject", notice.Title)
	assert.Equal(t, "legacy body", notice.Content)
	wire, err := common.Marshal(notice)
	require.NoError(t, err)
	assert.NotContains(t, string(wire), "EmailTemplate")
	assert.NotContains(t, string(wire), i18n.EmailChannelTest)
	for _, message := range smtp.Messages()[before+7:] {
		for _, lang := range i18n.SupportedLanguages() {
			if message.To == lang+"@parallel.test" {
				assert.Contains(t, message.HTML, `lang="`+lang+`"`)
			}
		}
	}
	constant.NotifyLimitCount = 1
	require.NoError(t, NotifyUser(75000, "limit@example.test", dto.UserSetting{Language: "vi"}, notice))
	require.ErrorContains(t, NotifyUser(75000, "limit@example.test", dto.UserSetting{Language: "vi"}, notice), "notification limit")
	_, _, err = i18n.RenderEmail("vi", "missing", nil)
	require.Error(t, err)
	require.NoError(t, smtp.Close())
	require.Error(t, SendLocalizedEmail("en", i18n.EmailChannelTest, "fail@example.test", nil), "SMTP failure must propagate")
}
