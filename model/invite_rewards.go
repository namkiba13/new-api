package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/QuantumNous/new-api/common"
	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func InviteTopupSource(tradeNo string) string {
	return fmt.Sprintf("topup:%x", sha256.Sum256([]byte(tradeNo)))
}

func InviteRedemptionSource(key string) string {
	return fmt.Sprintf("redeem:%x", sha256.Sum256([]byte(key)))
}

var legacyInviteAmountPattern = regexp.MustCompile(`[-+]?\d+(?:\.\d+)?`)

func legacyInviteIncrease(params map[string]interface{}) bool {
	values := make([]decimal.Decimal, 0, 2)
	for _, key := range []string{"from", "to"} {
		matches := legacyInviteAmountPattern.FindAllString(fmt.Sprint(params[key]), -1)
		if len(matches) == 0 {
			return true
		} // Unknown legacy history must not re-award a first funding.
		value, err := decimal.NewFromString(matches[len(matches)-1])
		if err != nil {
			return true
		}
		values = append(values, value)
	}
	return values[1].GreaterThan(values[0])
}

// Stripe supplies cumulative refunded amounts in the original charge currency.
// Scale against credited principal so currency discounts cannot over-reverse.
func ReverseInvitePayment(reference string, refunded, total int64) error {
	if reference == "" || total <= 0 || refunded < 0 || refunded > total {
		return ErrInviteRequest
	}
	var event InviteFunding
	err := DB.Where("payment_reference = ?", reference).First(&event).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	} // historical/non-wallet charge
	if err != nil {
		return err
	}
	quota := decimal.NewFromInt(int64(event.Quota)).Mul(decimal.NewFromInt(refunded)).Div(decimal.NewFromInt(total)).Floor().IntPart()
	return ReverseInviteRewards(event.Source, int(quota))
}

// One-time legacy history import. No bonuses are awarded by this migration.
// Administrative audit records are read from LOG_DB, including a separate log DB.
func InitializeInviteHistory() error {
	p, err := GetInviteProgram()
	if err != nil {
		return err
	}
	if p.HistoryReady {
		return nil
	}
	var tops []TopUp
	if err := DB.Where("status = ?", common.TopUpStatusSuccess).Find(&tops).Error; err != nil {
		return err
	}
	var codes []Redemption
	if err := DB.Where("status = ?", common.RedemptionCodeStatusUsed).Find(&codes).Error; err != nil {
		return err
	}
	var logs []Log
	if err := LOG_DB.Where("type = ?", LogTypeManage).Find(&logs).Error; err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		p, err := lockInviteProgram(tx)
		if err != nil {
			return err
		}
		if p.HistoryReady {
			return nil
		}
		for _, top := range tops {
			e := InviteFunding{Source: InviteTopupSource(top.TradeNo), UserID: top.UserId, CreatedAt: top.CompleteTime, Legacy: true}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&e).Error; err != nil {
				return err
			}
		}
		for _, code := range codes {
			e := InviteFunding{Source: InviteRedemptionSource(code.Key), UserID: code.UsedUserId, CreatedAt: code.RedeemedTime, Legacy: true}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&e).Error; err != nil {
				return err
			}
		}
		for _, log := range logs {
			var outer struct {
				Op struct {
					Action string                 `json:"action"`
					Params map[string]interface{} `json:"params"`
				} `json:"op"`
			}
			if common.UnmarshalJsonStr(log.Other, &outer) != nil {
				continue
			}
			info := outer.Op
			if info.Action != "user.quota_add" && info.Action != "user.quota_override" {
				continue
			}
			if info.Action == "user.quota_override" && !legacyInviteIncrease(info.Params) {
				continue
			}
			id := log.UserId
			if target, ok := info.Params["target_user_id"].(float64); ok {
				id = int(target)
			}
			e := InviteFunding{Source: fmt.Sprintf("legacy-admin:%d", log.Id), UserID: id, CreatedAt: log.CreatedAt, Legacy: true}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&e).Error; err != nil {
				return err
			}
		}
		return tx.Model(&InviteProgram{}).Where("id = ?", 1).Update("history_ready", true).Error
	})
}

// InviteProgram is read transactionally, rather than from a per-process cache.
// Rates are basis points (800 = 8% for EACH participant); quota stays integer.
type InviteProgram struct {
	ID           int    `json:"-" gorm:"primaryKey"`
	Enabled      bool   `json:"enabled"`
	Mode         string `json:"mode" gorm:"type:varchar(16)"`
	RateBps      int    `json:"rate_bps"`
	HoldHours    int    `json:"hold_hours"`
	Revision     int    `json:"revision"`
	LockVersion  int64  `json:"-"`
	HistoryReady bool   `json:"-"`
}

type InviteFunding struct {
	Source           string `json:"source" gorm:"primaryKey;type:varchar(128)"`
	PaymentReference string `json:"-" gorm:"type:varchar(255);index"`
	UserID           int    `json:"user_id" gorm:"index"`
	InviterID        int    `json:"inviter_id" gorm:"index"`
	Quota            int    `json:"quota"`
	RefundedQuota    int    `json:"refunded_quota"`
	RateBps          int    `json:"rate_bps"`
	RewardQuota      int    `json:"reward_quota"`
	ReversedQuota    int    `json:"reversed_quota"`
	CreatedAt        int64  `json:"created_at"`
	AvailableAt      int64  `json:"available_at" gorm:"index"`
	RetryAfter       int64  `json:"-" gorm:"index"`
	ReleasedAt       int64  `json:"released_at"`
	// Legacy rows establish first funding without awarding historical bonuses.
	Legacy bool `json:"legacy"`
}

type InviteDebt struct {
	UserID int `json:"user_id" gorm:"primaryKey"`
	Quota  int `json:"quota"`
}

type InviteTransfer struct {
	ID        string `json:"id" gorm:"primaryKey;type:varchar(128)"`
	UserID    int    `json:"user_id" gorm:"index"`
	Quota     int    `json:"quota"`
	Kind      string `json:"kind" gorm:"type:varchar(16)"`
	CreatedAt int64  `json:"created_at"`
}

var ErrInviteRequest = errors.New("Invalid invite rewards request")
var ErrInviteConflict = errors.New("Invite rewards request conflicts with an existing transaction")
var ErrInviteUnavailable = errors.New("Invite rewards are not available")

func MigrateInviteRewards(db *gorm.DB) error {
	if err := db.AutoMigrate(&InviteProgram{}, &InviteFunding{}, &InviteDebt{}, &InviteTransfer{}); err != nil {
		return err
	}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&InviteProgram{ID: 1, Mode: "first", RateBps: 800, HoldHours: 24}).Error; err != nil {
		return err
	}
	// Retire repeat awards without changing earned/pending rewards or other settings.
	return db.Model(&InviteProgram{}).Where("id = ? AND (mode IS NULL OR mode <> ?)", 1, "first").Updates(map[string]interface{}{"mode": "first", "revision": gorm.Expr("COALESCE(revision, 0) + 1")}).Error
}

func GetInviteProgram() (InviteProgram, error) {
	var p InviteProgram
	err := DB.First(&p, 1).Error
	return p, err
}

func lockInviteProgram(tx *gorm.DB) (InviteProgram, error) {
	// ponytail: one short DB write lock serializes funding/release/refund/transfer
	// across processes and SQLite; partition by account if measured throughput needs it.
	r := tx.Model(&InviteProgram{}).Where("id = ?", 1).UpdateColumn("lock_version", gorm.Expr("lock_version + 1"))
	if r.Error != nil {
		return InviteProgram{}, r.Error
	}
	if r.RowsAffected != 1 {
		return InviteProgram{}, ErrInviteUnavailable
	}
	var p InviteProgram
	err := tx.First(&p, 1).Error
	return p, err
}

// Lock before reading a funding row: SQLite cannot upgrade an older read
// snapshot when a concurrent writer has committed. Retry only errors that
// guarantee transaction rollback, including mixed-version rollout deadlocks.
func inviteFundingTransaction(fn func(*gorm.DB) error) error {
	for attempt := 0; ; attempt++ {
		err := DB.Transaction(func(tx *gorm.DB) error {
			if _, err := lockInviteProgram(tx); err != nil {
				return err
			}
			return fn(tx)
		})
		if err == nil || attempt == 3 {
			return err
		}
		var sqliteErr interface{ Code() int }
		var pgErr interface{ SQLState() string }
		var myErr *mysqldriver.MySQLError
		retry := (errors.As(err, &sqliteErr) && (sqliteErr.Code()&255 == 5 || sqliteErr.Code()&255 == 6)) ||
			(errors.As(err, &pgErr) && (pgErr.SQLState() == "40001" || pgErr.SQLState() == "40P01")) ||
			(errors.As(err, &myErr) && (myErr.Number == 1213 || myErr.Number == 1205))
		if !retry {
			return err
		}
		time.Sleep(time.Duration(10<<attempt) * time.Millisecond)
	}
}

func SaveInviteProgram(p InviteProgram) error {
	if p.Mode != "first" || p.RateBps < 0 || p.RateBps > 10000 || p.HoldHours < 0 || p.HoldHours > 8760 {
		return ErrInviteRequest
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		current, err := lockInviteProgram(tx)
		if err != nil {
			return err
		}
		if current.Revision != p.Revision {
			return ErrInviteConflict
		}
		if p.Enabled && !current.HistoryReady {
			return ErrInviteUnavailable
		}
		return tx.Model(&InviteProgram{}).Where("id = ?", 1).Updates(map[string]interface{}{"enabled": p.Enabled, "mode": p.Mode, "rate_bps": p.RateBps, "hold_hours": p.HoldHours, "revision": p.Revision + 1}).Error
	})
}

// RecordInviteFunding must be called INSIDE the transaction confirming the
// funding, before modifying the wallet. Never call it from generic quota refunds.
func RecordInviteFunding(tx *gorm.DB, source string, userID, quota int) (bool, error) {
	if source == "" || len(source) > 128 || userID <= 0 || quota <= 0 || quota > common.MaxWalletQuota {
		return false, ErrInviteRequest
	}
	p, err := lockInviteProgram(tx)
	if err != nil {
		return false, err
	}
	var existing InviteFunding
	err = tx.Where("source = ?", source).First(&existing).Error
	if err == nil {
		if existing.UserID != userID || existing.Quota != quota {
			return false, ErrInviteConflict
		}
		return true, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}
	var user User
	if err := tx.First(&user, userID).Error; err != nil {
		return false, err
	}
	var count int64
	if err := tx.Model(&InviteFunding{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return false, err
	}
	now := common.GetTimestamp()
	event := InviteFunding{Source: source, UserID: userID, InviterID: user.InviterId, Quota: quota, CreatedAt: now}
	if p.Enabled && p.HistoryReady && p.RateBps > 0 && count == 0 && user.InviterId > 0 && user.InviterId != userID && user.Status == common.UserStatusEnabled {
		var inviter User
		if err := tx.First(&inviter, user.InviterId).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return false, err
		}
		if inviter.Id > 0 && inviter.Status == common.UserStatusEnabled {
			event.RateBps = p.RateBps
			// Quotient/remainder avoids overflow near the wallet quota ceiling.
			event.RewardQuota = quota/10000*p.RateBps + quota%10000*p.RateBps/10000
			event.AvailableAt = now + int64(p.HoldHours)*3600
		}
	}
	if err := tx.Create(&event).Error; err != nil {
		return false, err
	}
	return false, nil
}

func creditInviteFunding(tx *gorm.DB, source string, userID, quota int, updates map[string]interface{}) error {
	duplicate, err := RecordInviteFunding(tx, source, userID, quota)
	if err != nil || duplicate {
		return err
	}
	if err := creditTopUpQuota(tx, userID, quota, updates); err != nil {
		return err
	}
	return nil
}

func inviteDebt(tx *gorm.DB, userID int) (InviteDebt, error) {
	debt := InviteDebt{UserID: userID}
	err := tx.First(&debt, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return debt, nil
	}
	return debt, err
}

func creditInviteReward(tx *gorm.DB, userID, quota int, inviter bool) error {
	debt, err := inviteDebt(tx, userID)
	if err != nil {
		return err
	}
	repaid := min(debt.Quota, quota)
	if repaid > 0 {
		debt.Quota -= repaid
		if err := tx.Save(&debt).Error; err != nil {
			return err
		}
	}
	quota -= repaid
	if inviter {
		r := tx.Model(&User{}).Where("id = ? AND aff_quota <= ? AND aff_history <= ?", userID, common.MaxWalletQuota-quota, common.MaxWalletQuota-quota-repaid).Updates(map[string]interface{}{"aff_quota": gorm.Expr("aff_quota + ?", quota), "aff_history": gorm.Expr("aff_history + ?", quota+repaid)})
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return ErrWalletQuotaLimitExceeded
		}
		return nil
	}
	if quota == 0 {
		return nil
	}
	return creditTopUpQuota(tx, userID, quota, nil) // deliberately NOT creditInviteFunding
}

func releaseInviteFunding(tx *gorm.DB, source string, now int64, credits map[int]int) error {
	var event InviteFunding
	if err := tx.Where("source = ?", source).First(&event).Error; err != nil {
		return err
	}
	if event.RewardQuota == 0 || event.ReleasedAt != 0 || event.AvailableAt > now || event.ReversedQuota >= event.RewardQuota {
		return nil
	}
	for _, id := range []int{event.InviterID, event.UserID} {
		var u User
		if err := tx.First(&u, id).Error; err != nil {
			return err
		}
		if u.Status != common.UserStatusEnabled {
			return ErrInviteUnavailable
		}
		debt, err := inviteDebt(tx, id)
		if err != nil {
			return err
		}
		if err := creditInviteReward(tx, id, event.RewardQuota-event.ReversedQuota, id == event.InviterID); err != nil {
			return err
		}
		if id == event.UserID {
			credits[id] = max(0, event.RewardQuota-event.ReversedQuota-debt.Quota)
		}
	}
	return tx.Model(&InviteFunding{}).Where("source = ?", source).Update("released_at", now).Error
}

func ReleaseInviteRewards(now int64) error {
	var events []InviteFunding
	if err := DB.Where("reward_quota > reversed_quota AND released_at = 0 AND available_at <= ? AND retry_after <= ?", now, now).Order("available_at, source").Limit(200).Find(&events).Error; err != nil {
		return err
	}
	var failures []error
	for _, event := range events {
		credits := map[int]int{}
		err := DB.Transaction(func(tx *gorm.DB) error {
			if _, err := lockInviteProgram(tx); err != nil {
				return err
			}
			return releaseInviteFunding(tx, event.Source, now, credits)
		})
		if err != nil {
			failures = append(failures, err)
			// A blocked/disabled account must not starve all later rewards.
			if retryErr := DB.Model(&InviteFunding{}).Where("source = ? AND released_at = 0", event.Source).Update("retry_after", now+60).Error; retryErr != nil {
				failures = append(failures, retryErr)
			}
			continue
		}
		for id, quota := range credits {
			if err := cacheIncrUserQuota(id, int64(quota)); err != nil {
				common.SysError("invite credit cache: " + err.Error())
			}
		}
	}
	return errors.Join(failures...)
}

func StartInviteRewardWorker() {
	go func() {
		for {
			if err := ReleaseInviteRewards(common.GetTimestamp()); err != nil {
				common.SysError("invite reward release: " + err.Error())
			}
			time.Sleep(30 * time.Second)
		}
	}()
}

// Admin funding has a caller-supplied idempotency key so an ambiguous timeout
// can be retried without repeating the credit OR the associated rewards.
func AdminInviteFunding(userID, value int, mode, key string) error {
	if len(key) < 16 || len(key) > 80 || (mode != "add" && mode != "override") || value < 0 || value > common.MaxWalletQuota {
		return ErrInviteRequest
	}
	source := "admin:" + key
	deltaCommitted := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		if _, err := lockInviteProgram(tx); err != nil {
			return err
		}
		var transfer InviteTransfer
		if err := tx.Where("id = ?", source).First(&transfer).Error; err == nil {
			if transfer.UserID != userID || transfer.Quota != value || transfer.Kind != mode {
				return ErrInviteConflict
			}
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		delta := value
		if mode == "override" {
			delta = value - user.Quota
		}
		if delta > 0 {
			if err := creditInviteFunding(tx, source, userID, delta, nil); err != nil {
				return err
			}
		} else if mode == "override" {
			if err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", value).Error; err != nil {
				return err
			}
		} else {
			return ErrInviteRequest
		}
		deltaCommitted = delta
		return tx.Create(&InviteTransfer{ID: source, UserID: userID, Quota: value, Kind: mode, CreatedAt: common.GetTimestamp()}).Error
	})
	if err == nil {
		_ = cacheIncrUserQuota(userID, int64(deltaCommitted))
		_ = ReleaseInviteRewards(common.GetTimestamp())
	}
	return err
}

func TransferInviteRewards(userID, amount int, key string) (int, error) {
	if len(key) < 16 || len(key) > 80 || amount < 0 || amount > common.MaxWalletQuota {
		return 0, ErrInviteRequest
	}
	transferred := 0
	newTransfer := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		if _, err := lockInviteProgram(tx); err != nil {
			return err
		}
		id := fmt.Sprintf("transfer:%d:%s", userID, key)
		var old InviteTransfer
		if err := tx.Where("id = ?", id).First(&old).Error; err == nil {
			transferred = old.Quota
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		debt, err := inviteDebt(tx, userID)
		if err != nil {
			return err
		}
		if debt.Quota > 0 {
			return ErrInviteUnavailable
		}
		var u User
		if err := lockForUpdate(tx).First(&u, userID).Error; err != nil {
			return err
		}
		transferred = amount
		if amount == 0 {
			transferred = u.AffQuota
		}
		if transferred <= 0 || transferred > u.AffQuota {
			return ErrInviteUnavailable
		}
		if err := creditTopUpQuota(tx, userID, transferred, map[string]interface{}{"aff_quota": gorm.Expr("aff_quota - ?", transferred)}); err != nil {
			return err
		}
		newTransfer = true
		return tx.Create(&InviteTransfer{ID: id, UserID: userID, Quota: transferred, CreatedAt: common.GetTimestamp()}).Error
	})
	if err == nil && newTransfer {
		_ = cacheIncrUserQuota(userID, int64(transferred))
	}
	return transferred, err
}

// refunded is the cumulative refunded PRINCIPAL quota, not an incremental
// amount. Duplicate and out-of-order refund notifications cannot double debit.
// This reverses referral bonuses only; it never initiates a gateway refund.
func ReverseInviteRewards(source string, refunded int) error {
	if source == "" || refunded < 0 {
		return ErrInviteRequest
	}
	var event InviteFunding
	debits := map[int]int{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if _, err := lockInviteProgram(tx); err != nil {
			return err
		}
		if err := tx.Where("source = ?", source).First(&event).Error; err != nil {
			return err
		}
		if refunded > event.Quota {
			return ErrInviteRequest
		}
		if refunded <= event.RefundedQuota {
			return nil
		}
		remaining := event.Quota - refunded
		remainingReward := remaining/10000*event.RateBps + remaining%10000*event.RateBps/10000
		reversed := event.RewardQuota - remainingReward
		delta := reversed - event.ReversedQuota
		if event.ReleasedAt > 0 && delta > 0 {
			for _, id := range []int{event.InviterID, event.UserID} {
				var u User
				if err := lockForUpdate(tx).First(&u, id).Error; err != nil {
					return err
				}
				left := delta
				fromRewards := 0
				if id == event.InviterID {
					fromRewards = min(max(u.AffQuota, 0), left)
					left -= fromRewards
				}
				fromWallet := min(max(u.Quota, 0), left)
				left -= fromWallet
				updates := map[string]interface{}{"quota": gorm.Expr("quota - ?", fromWallet)}
				if id == event.InviterID {
					updates["aff_quota"] = gorm.Expr("aff_quota - ?", fromRewards)
				}
				if err := tx.Model(&User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
					return err
				}
				debits[id] = fromWallet
				if left > 0 {
					debt, err := inviteDebt(tx, id)
					if err != nil {
						return err
					}
					if debt.Quota > common.MaxWalletQuota-left {
						return ErrWalletQuotaLimitExceeded
					}
					debt.Quota += left
					if err := tx.Save(&debt).Error; err != nil {
						return err
					}
				}
			}
		}
		return tx.Model(&InviteFunding{}).Where("source = ?", source).Updates(map[string]interface{}{"refunded_quota": refunded, "reversed_quota": reversed}).Error
	})
	if err == nil {
		for id, quota := range debits {
			_ = cacheIncrUserQuota(id, -int64(quota))
		}
	}
	return err
}

type InviteSummary struct {
	Program      InviteProgram `json:"program"`
	Code         string        `json:"code"`
	Qualified    int64         `json:"qualified"`
	Pending      int64         `json:"pending"`
	PendingQuota int64         `json:"pending_quota"`
	Released     int64         `json:"released"`
	Reversed     int64         `json:"reversed"`
	Balance      int           `json:"balance"`
	Lifetime     int           `json:"lifetime"`
	Debt         int           `json:"debt"`
}

func GetInviteSummary(userID int) (InviteSummary, error) {
	var result InviteSummary
	err := DB.Transaction(func(tx *gorm.DB) error {
		p, err := lockInviteProgram(tx)
		if err != nil {
			return err
		}
		result.Program = p
		var u User
		if err := tx.First(&u, userID).Error; err != nil {
			return err
		}
		result.Code = u.AffCode
		result.Balance = u.AffQuota
		result.Lifetime = u.AffHistoryQuota
		debt, err := inviteDebt(tx, userID)
		if err != nil {
			return err
		}
		result.Debt = debt.Quota
		q := func() *gorm.DB {
			return tx.Model(&InviteFunding{}).Where("inviter_id = ? AND reward_quota > 0", userID)
		}
		if err := q().Count(&result.Qualified).Error; err != nil {
			return err
		}
		if err := q().Where("released_at = 0 AND reward_quota > reversed_quota").Count(&result.Pending).Error; err != nil {
			return err
		}
		if err := q().Where("released_at = 0").Select("COALESCE(SUM(reward_quota - reversed_quota), 0)").Scan(&result.PendingQuota).Error; err != nil {
			return err
		}
		if err := q().Where("released_at > 0").Count(&result.Released).Error; err != nil {
			return err
		}
		return q().Where("reversed_quota > 0").Count(&result.Reversed).Error
	})
	return result, err
}
