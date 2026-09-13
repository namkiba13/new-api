package model

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func inviteLab(t *testing.T, mode string, hold int) {
	t.Helper()
	oldDB, oldLog := DB, LOG_DB
	oldType := common.MainDatabaseType()
	oldRedis := common.RedisEnabled
	var dialector gorm.Dialector
	dsn := os.Getenv("INVITE_LAB_DSN")
	dialect := os.Getenv("INVITE_LAB_ENGINE")
	switch dialect {
	case "mysql":
		require.Contains(t, dsn, "invite_lab")
		dialector = mysql.Open(dsn)
		common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeMySQL)
	case "postgres":
		require.Contains(t, dsn, "invite_lab")
		dialector = postgres.Open(dsn)
		common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, common.DatabaseTypePostgreSQL)
	default:
		dialector = sqlite.Open(fmt.Sprintf("file:%s?_pragma=busy_timeout(10000)", t.TempDir()+"/invite.db"))
		common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	}
	db, err := gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	DB, LOG_DB = db, db
	common.RedisEnabled = false
	initCol()
	conn, err := db.DB()
	require.NoError(t, err)
	conn.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Redemption{}, &Log{}))
	require.NoError(t, MigrateInviteRewards(db))
	for _, table := range []string{"invite_fundings", "invite_debts", "invite_transfers", "users", "top_ups", "redemptions", "logs"} {
		require.NoError(t, db.Exec("DELETE FROM "+table).Error)
	}
	require.NoError(t, db.Model(&InviteProgram{}).Where("id = ?", 1).Updates(map[string]interface{}{"history_ready": false, "enabled": false}).Error)
	require.NoError(t, InitializeInviteHistory())
	p, err := GetInviteProgram()
	require.NoError(t, err)
	p.Enabled = true
	p.Mode = mode
	p.HoldHours = hold
	p.RateBps = 800
	require.NoError(t, SaveInviteProgram(p))
	for _, u := range []User{{Id: 1, Username: "lab-a", AffCode: "lab-a", Status: 1}, {Id: 2, Username: "lab-b", AffCode: "lab-b", Status: 1, InviterId: 1}, {Id: 3, Username: "lab-c", AffCode: "lab-c", Status: 1, InviterId: 2}, {Id: 4, Username: "lab-d", AffCode: "lab-d", Status: 1}} {
		require.NoError(t, db.Create(&u).Error)
	}
	t.Cleanup(func() {
		conn.Close()
		DB, LOG_DB = oldDB, oldLog
		common.RedisEnabled = oldRedis
		common.SetDatabaseTypes(oldType, oldType)
		initCol()
	})
}

func inviteUserState(t *testing.T, id int) User {
	t.Helper()
	var u User
	require.NoError(t, DB.First(&u, id).Error)
	return u
}

func TestInviteDirectionsSourcesAndModes(t *testing.T) {
	for _, mode := range []string{"first", "all"} {
		t.Run(mode, func(t *testing.T) {
			inviteLab(t, mode, 0)
			code := Redemption{Id: 1, Key: "lab-redeem", Status: common.RedemptionCodeStatusEnabled, Quota: 10000}
			require.NoError(t, DB.Create(&code).Error)
			_, err := Redeem(code.Key, 2)
			require.NoError(t, err)
			assert.Equal(t, 800, inviteUserState(t, 1).AffQuota)
			assert.Equal(t, 10800, inviteUserState(t, 2).Quota)
			_, err = Redeem(code.Key, 2)
			require.Error(t, err)
			top := TopUp{UserId: 2, TradeNo: "lab-waffo", Amount: 1, Money: 1, PaymentProvider: PaymentProviderWaffo, Status: common.TopUpStatusPending}
			require.NoError(t, DB.Create(&top).Error)
			require.NoError(t, RechargeWaffo(top.TradeNo, "127.0.0.1"))
			require.NoError(t, RechargeWaffo(top.TradeNo, "127.0.0.1"))
			require.NoError(t, AdminInviteFunding(2, 20000, "add", strings.Repeat("a", 32)))
			require.NoError(t, AdminInviteFunding(2, 20000, "add", strings.Repeat("a", 32)))
			expected := 800
			if mode == "all" {
				expected += int(common.QuotaPerUnit)*8/100 + 1600
			}
			assert.Equal(t, expected, inviteUserState(t, 1).AffQuota)
			beforeB := inviteUserState(t, 2)
			require.NoError(t, AdminInviteFunding(1, 10000, "add", strings.Repeat("b", 32)))
			assert.Equal(t, beforeB.Quota, inviteUserState(t, 2).Quota, "A funding never rewards B")
			require.NoError(t, AdminInviteFunding(3, 10000, "add", strings.Repeat("c", 32)))
			assert.Equal(t, expected, inviteUserState(t, 1).AffQuota, "C funding must not reward grandparent A")
			assert.Equal(t, 800, inviteUserState(t, 2).AffQuota)
			_, err = TransferInviteRewards(2, 0, strings.Repeat("d", 32))
			require.NoError(t, err)
			assert.Equal(t, expected, inviteUserState(t, 1).AffQuota, "transfer must not recurse")
			require.NoError(t, IncreaseUserQuota(2, 5000, true))
			assert.Equal(t, expected, inviteUserState(t, 1).AffQuota, "generic refunds/gifts do not qualify")
		})
	}
}

func TestInviteHoldSnapshotReversalAndDebt(t *testing.T) {
	inviteLab(t, "all", 24)
	key := strings.Repeat("h", 32)
	require.NoError(t, AdminInviteFunding(2, 10000, "add", key))
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	p, err := GetInviteProgram()
	require.NoError(t, err)
	p.RateBps = 2000
	p.HoldHours = 0
	require.NoError(t, SaveInviteProgram(p))
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+86300))
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+86401))
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+86401))
	assert.Equal(t, 800, inviteUserState(t, 1).AffQuota, "stored rate remains 8%")
	_, err = TransferInviteRewards(1, 0, strings.Repeat("t", 32))
	require.NoError(t, err)
	_, err = TransferInviteRewards(1, 0, strings.Repeat("t", 32))
	require.NoError(t, err)
	assert.Equal(t, 800, inviteUserState(t, 1).Quota)
	require.NoError(t, DB.Model(&User{}).Where("id IN ?", []int{1, 2}).Update("quota", 0).Error)
	require.NoError(t, ReverseInviteRewards("admin:"+key, 5000))
	require.NoError(t, ReverseInviteRewards("admin:"+key, 5000))
	d, err := inviteDebt(DB, 1)
	require.NoError(t, err)
	assert.Equal(t, 400, d.Quota)
	require.NoError(t, ReverseInviteRewards("admin:"+key, 10000))
	d, err = inviteDebt(DB, 1)
	require.NoError(t, err)
	assert.Equal(t, 800, d.Quota)
	require.NoError(t, ReverseInviteRewards("admin:"+key, 5000))
	assert.Zero(t, inviteUserState(t, 1).Quota)
	require.NoError(t, AdminInviteFunding(2, 10000, "add", strings.Repeat("j", 32)))
	assert.Equal(t, 1200, inviteUserState(t, 1).AffQuota, "20% reward first repays 800 debt")
}

func TestInviteConcurrentFirstFundingAndTransfer(t *testing.T) {
	inviteLab(t, "first", 0)
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs <- AdminInviteFunding(2, 10000, "add", fmt.Sprintf("concurrent-funding-%020d", i))
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 800, inviteUserState(t, 1).AffQuota)
	assert.Equal(t, 80800, inviteUserState(t, 2).Quota)
	errs = make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := TransferInviteRewards(1, 0, "same-transfer-request-0001")
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 800, inviteUserState(t, 1).Quota)
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
}

func TestInviteMigrationDisabledLimitsAndOverride(t *testing.T) {
	inviteLab(t, "first", 0)
	p, err := GetInviteProgram()
	require.NoError(t, err)
	p.Enabled = false
	require.NoError(t, SaveInviteProgram(p))
	require.NoError(t, AdminInviteFunding(2, 5000, "add", "disabled-funding-0000001"))
	p, err = GetInviteProgram()
	require.NoError(t, err)
	p.Enabled = true
	require.NoError(t, SaveInviteProgram(p))
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "enabled-funding-00000001"))
	assert.Zero(t, inviteUserState(t, 1).AffQuota, "first funding is not reset on activation")
	p, err = GetInviteProgram()
	require.NoError(t, err)
	p.Mode = "all"
	p.RateBps = 125
	require.NoError(t, SaveInviteProgram(p))
	require.NoError(t, AdminInviteFunding(2, 20000, "override", "override-funding-00000001"))
	assert.Equal(t, 62, inviteUserState(t, 1).AffQuota, "1.25% of positive delta 5000, floored")
	require.Error(t, AdminInviteFunding(2, 20001, "override", "override-funding-00000001"))
	require.NoError(t, MigrateInviteRewards(DB))
	require.NoError(t, InitializeInviteHistory())
	assert.Equal(t, 62, inviteUserState(t, 1).AffQuota)
	p, err = GetInviteProgram()
	require.NoError(t, err)
	p.RateBps = 10001
	require.Error(t, SaveInviteProgram(p))
	require.Error(t, AdminInviteFunding(2, common.MaxWalletQuota, "add", "overflow-funding-00000001"))
	assert.Equal(t, 20062, inviteUserState(t, 2).Quota)
	var n int64
	require.NoError(t, DB.Model(&InviteFunding{}).Where("source = ?", "admin:overflow-funding-00000001").Count(&n).Error)
	assert.Zero(t, n, "failed credit rolls back reward event")
}

func TestInviteLegacyHistoryAndOAuthAttribution(t *testing.T) {
	inviteLab(t, "first", 0)
	require.NoError(t, DB.Model(&InviteProgram{}).Where("id = ?", 1).Update("history_ready", false).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: 2, TradeNo: "before-upgrade", Status: common.TopUpStatusSuccess}).Error)
	op, _ := common.Marshal(map[string]interface{}{"op": map[string]interface{}{"action": "user.quota_override", "params": map[string]interface{}{"target_user_id": 3, "from": "＄10.000000 额度", "to": "＄0.000000 额度"}}})
	require.NoError(t, DB.Create(&Log{UserId: 1, Type: LogTypeManage, Other: string(op)}).Error)
	require.NoError(t, InitializeInviteHistory())
	require.NoError(t, InitializeInviteHistory())
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "after-upgrade-funding-001"))
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	require.NoError(t, AdminInviteFunding(3, 10000, "add", "after-upgrade-funding-002"))
	assert.Equal(t, 800, inviteUserState(t, 2).AffQuota, "decreasing a legacy balance was not a first funding")
	u := User{Id: 5, Username: "oauth-friend", Status: 1, Role: 1}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return u.InsertWithTx(tx, 1) }))
	assert.Equal(t, 1, inviteUserState(t, u.Id).InviterId)
	require.NoError(t, AdminInviteFunding(u.Id, 10000, "add", "oauth-funding-0000000001"))
	assert.Equal(t, 800, inviteUserState(t, 1).AffQuota)
}

func TestInvitePendingRefundAndAllPaymentProviders(t *testing.T) {
	inviteLab(t, "all", 24)
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "pending-refund-test-0001"))
	require.NoError(t, ReverseInviteRewards("admin:pending-refund-test-0001", 10000))
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+90000))
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	p, err := GetInviteProgram()
	require.NoError(t, err)
	p.HoldHours = 0
	require.NoError(t, SaveInviteProgram(p))
	for _, provider := range []string{PaymentProviderStripe, PaymentProviderEpay, PaymentProviderCreem, PaymentProviderWaffo, PaymentProviderWaffoPancake} {
		top := TopUp{UserId: 2, TradeNo: "provider-" + provider, Amount: 1, Money: 1, PaymentProvider: provider, PaymentMethod: provider, Status: common.TopUpStatusPending}
		if provider == PaymentProviderCreem {
			top.Amount = int64(common.QuotaPerUnit)
		}
		require.NoError(t, DB.Create(&top).Error)
		switch provider {
		case PaymentProviderStripe:
			require.NoError(t, Recharge(top.TradeNo, "cus_lab", "127.0.0.1", "pi_lab"))
		case PaymentProviderEpay:
			_, err := RechargeEpay(top.TradeNo, "epay", "127.0.0.1")
			require.NoError(t, err)
		case PaymentProviderCreem:
			require.NoError(t, RechargeCreem(top.TradeNo, "", "", "127.0.0.1"))
		case PaymentProviderWaffo:
			require.NoError(t, RechargeWaffo(top.TradeNo, "127.0.0.1"))
		case PaymentProviderWaffoPancake:
			require.NoError(t, RechargeWaffoPancake(top.TradeNo))
		}
	}
	assert.Equal(t, int(common.QuotaPerUnit)*8/100*5, inviteUserState(t, 1).AffQuota)
	require.NoError(t, ReverseInvitePayment("pi_lab", 50, 100))
	require.NoError(t, ReverseInvitePayment("pi_lab", 50, 100))
	assert.Equal(t, int(common.QuotaPerUnit)*8/100*5-int(common.QuotaPerUnit)*4/100, inviteUserState(t, 1).AffQuota)
}
