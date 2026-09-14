package model

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type InviteBalances struct {
	Wallet  int `json:"wallet"`
	Rewards int `json:"rewards"`
	Debt    int `json:"debt"`
}

// Append-only, recipient-specific reward journal. Old funding rows are never
// backfilled with invented balances or inferred net payments.
type InviteJournal struct {
	ID          int64           `json:"id" gorm:"primaryKey"`
	EventKey    string          `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	Source      string          `json:"source" gorm:"type:varchar(128);index"`
	UserID      int             `json:"user_id" gorm:"index"`
	Username    string          `json:"username" gorm:"type:varchar(64)"`
	Role        string          `json:"role" gorm:"type:varchar(16)"`
	Action      string          `json:"action" gorm:"type:varchar(16);index"`
	Principal   int             `json:"principal"`
	RateBps     int             `json:"rate_bps"`
	Gross       int             `json:"gross"`
	Offset      int             `json:"offset" gorm:"column:debt_offset"`
	WalletDelta int             `json:"wallet_delta"`
	RewardDelta int             `json:"reward_delta"`
	DebtDelta   int             `json:"debt_delta"`
	Before      *InviteBalances `json:"before" gorm:"serializer:json;type:text;column:before_snapshot"`
	After       *InviteBalances `json:"after" gorm:"serializer:json;type:text;column:after_snapshot"`
	Legacy      bool            `json:"legacy"`
	CreatedAt   int64           `json:"created_at" gorm:"index"`
}

func inviteBalances(tx *gorm.DB, id int) (InviteBalances, string, error) {
	var u User
	if err := lockForUpdate(tx).First(&u, id).Error; err != nil {
		return InviteBalances{}, "", err
	}
	d, err := inviteDebt(tx, id)
	return InviteBalances{Wallet: u.Quota, Rewards: u.AffQuota, Debt: d.Quota}, u.Username, err
}

func appendInviteJournal(tx *gorm.DB, event InviteFunding, id int, role, action, discriminator string, gross int, before InviteBalances, at int64) error {
	after, name, err := inviteBalances(tx, id)
	if err != nil {
		return err
	}
	entry := InviteJournal{
		EventKey: fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s|%d|%s|%s", event.Source, id, action, discriminator)))),
		Source:   event.Source, UserID: id, Username: name, Role: role, Action: action,
		Principal: event.Quota, RateBps: event.RateBps, Gross: gross,
		Offset: max(0, before.Debt-after.Debt), WalletDelta: after.Wallet - before.Wallet,
		RewardDelta: after.Rewards - before.Rewards, DebtDelta: after.Debt - before.Debt,
		Before: &before, After: &after, CreatedAt: at,
	}
	return tx.Create(&entry).Error
}

func backfillInviteTransfers(db *gorm.DB) error {
	var transfers []InviteTransfer
	return db.Where("id LIKE ?", "transfer:%").FindInBatches(&transfers, 200, func(_ *gorm.DB, _ int) error {
		for _, transfer := range transfers {
			entry := InviteJournal{EventKey: fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s|%d|transferred|", transfer.ID, transfer.UserID)))), Source: transfer.ID, UserID: transfer.UserID, Role: "inviter", Action: "transferred", Gross: transfer.Quota, WalletDelta: transfer.Quota, RewardDelta: -transfer.Quota, CreatedAt: transfer.CreatedAt, Legacy: true}
			if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&entry).Error; err != nil {
				return err
			}
		}
		return nil
	}).Error
}

func journalInviteEarned(tx *gorm.DB, source string) error {
	var event InviteFunding
	if err := tx.Where("source = ?", source).First(&event).Error; err != nil {
		return err
	}
	if event.RewardQuota <= 0 {
		return nil
	}
	for _, participant := range []struct {
		id   int
		role string
	}{{event.InviterID, "inviter"}, {event.UserID, "invitee"}} {
		before, _, err := inviteBalances(tx, participant.id)
		if err != nil {
			return err
		}
		if err := appendInviteJournal(tx, event, participant.id, participant.role, "earned", "", event.RewardQuota, before, event.CreatedAt); err != nil {
			return err
		}
	}
	return nil
}

type InviteHistoryFilter struct {
	Page       int
	PageSize   int
	Role       string
	Query      string
	SourceKind string
	Status     string
	From       int64
	To         int64
}

func (f InviteHistoryFilter) Valid() bool {
	return f.Page > 0 && f.Page <= 100000 && f.PageSize > 0 && f.PageSize <= 100 && len(f.Query) <= 128 &&
		(f.Role == "" || f.Role == "inviter" || f.Role == "invitee") &&
		(f.SourceKind == "" || f.SourceKind == "topup" || f.SourceKind == "redeem" || f.SourceKind == "admin") &&
		(f.Status == "" || f.Status == "pending" || f.Status == "released" || f.Status == "reversed") &&
		f.From >= 0 && f.To >= 0 && (f.To == 0 || f.From <= f.To)
}

type InviteRecipient struct {
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	NetCredit *int   `json:"net_credit"`
	Offset    *int   `json:"offset"`
}

type InviteHistoryRow struct {
	InviteFunding
	InviteeName     string            `json:"invitee_name" gorm:"column:invitee_name"`
	InviterName     string            `json:"inviter_name" gorm:"column:inviter_name"`
	Status          string            `json:"status" gorm:"-"`
	Role            string            `json:"role" gorm:"-"`
	NetCredit       *int              `json:"net_credit" gorm:"-"`
	Offset          *int              `json:"offset" gorm:"-"`
	JournalComplete bool              `json:"journal_complete" gorm:"-"`
	Recipients      []InviteRecipient `json:"recipients,omitempty" gorm:"-"`
}

type InviteHistoryPage struct {
	Items []InviteHistoryRow `json:"items"`
	Total int64              `json:"total"`
}

// userID is always the authenticated user; zero is used ONLY by root-auth routes.
func GetInviteHistory(userID int, f InviteHistoryFilter) (InviteHistoryPage, error) {
	result := InviteHistoryPage{Items: []InviteHistoryRow{}}
	if userID < 0 || !f.Valid() {
		return result, ErrInviteRequest
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if _, err := lockInviteProgram(tx); err != nil {
			return err
		}
		q := tx.Table("invite_fundings AS f").Joins("LEFT JOIN users AS invitee ON invitee.id = f.user_id").Joins("LEFT JOIN users AS inviter ON inviter.id = f.inviter_id").Where("f.reward_quota > 0")
		if userID > 0 {
			if f.Role == "invitee" {
				q = q.Where("f.user_id = ?", userID)
			} else if f.Role == "inviter" {
				q = q.Where("f.inviter_id = ?", userID)
			} else {
				q = q.Where("(f.user_id = ? OR f.inviter_id = ?)", userID, userID)
			}
		}
		if f.Query != "" {
			pattern := "%" + strings.ToLower(strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(f.Query)) + "%"
			id, _ := strconv.Atoi(f.Query)
			q = q.Where("(LOWER(invitee.username) LIKE ? ESCAPE '!' OR LOWER(inviter.username) LIKE ? ESCAPE '!' OR LOWER(f.source) LIKE ? ESCAPE '!' OR f.user_id = ? OR f.inviter_id = ? OR f.source = ?)", pattern, pattern, pattern, id, id, InviteTopupSource(f.Query))
		}
		if f.SourceKind != "" {
			q = q.Where("f.source LIKE ?", f.SourceKind+":%")
		}
		if f.From > 0 {
			q = q.Where("f.created_at >= ?", f.From)
		}
		if f.To > 0 {
			q = q.Where("f.created_at <= ?", f.To)
		}
		switch f.Status {
		case "pending":
			q = q.Where("f.released_at = 0 AND f.reward_quota > f.reversed_quota")
		case "released":
			q = q.Where("f.released_at > 0 AND f.reward_quota > f.reversed_quota")
		case "reversed":
			q = q.Where("f.reversed_quota > 0")
		}
		if err := q.Count(&result.Total).Error; err != nil {
			return err
		}
		if err := q.Select("f.*, COALESCE(invitee.username, '') AS invitee_name, COALESCE(inviter.username, '') AS inviter_name").Order("f.created_at DESC, f.source").Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize).Scan(&result.Items).Error; err != nil {
			return err
		}
		if len(result.Items) == 0 {
			return nil
		}
		sources := make([]string, 0, len(result.Items))
		for _, row := range result.Items {
			sources = append(sources, row.Source)
		}
		var entries []InviteJournal
		jq := tx.Where("source IN ? AND action IN ?", sources, []string{"earned", "released"})
		if userID > 0 {
			jq = jq.Where("user_id = ?", userID)
		}
		if err := jq.Find(&entries).Error; err != nil {
			return err
		}
		for i := range result.Items {
			row := &result.Items[i]
			row.Status = "pending"
			if row.ReleasedAt > 0 {
				row.Status = "released"
			}
			if row.ReversedQuota >= row.RewardQuota {
				row.Status = "reversed"
			}
			if userID > 0 {
				row.Role = "inviter"
				if row.UserID == userID {
					row.Role = "invitee"
				}
			}
			people := []InviteRecipient{{UserID: row.InviterID, Username: row.InviterName, Role: "inviter"}, {UserID: row.UserID, Username: row.InviteeName, Role: "invitee"}}
			earnedCount := 0
			for j := range people {
				for _, entry := range entries {
					if entry.Source != row.Source || entry.UserID != people[j].UserID {
						continue
					}
					if entry.Action == "earned" {
						earnedCount++
					}
					if entry.Action == "released" {
						net := entry.WalletDelta + entry.RewardDelta
						offset := entry.Offset
						people[j].NetCredit = &net
						people[j].Offset = &offset
						if userID == entry.UserID {
							row.NetCredit = &net
							row.Offset = &offset
						}
					}
				}
			}
			if userID == 0 {
				row.Recipients = people
				row.JournalComplete = earnedCount == 2
			} else {
				row.JournalComplete = earnedCount == 1
			}
		}
		return nil
	})
	return result, err
}

type InviteJournalPage struct {
	Items []InviteJournal `json:"items"`
	Total int64           `json:"total"`
}

func GetInviteJournal(userID int, source string, transfers bool, f InviteHistoryFilter) (InviteJournalPage, error) {
	result := InviteJournalPage{Items: []InviteJournal{}}
	if userID < 0 || len(source) > 128 || !f.Valid() {
		return result, ErrInviteRequest
	}
	q := DB.Model(&InviteJournal{})
	if userID > 0 {
		q = q.Where("user_id = ?", userID)
	}
	if source != "" {
		q = q.Where("source = ?", source)
	} else if !transfers {
		return result, ErrInviteRequest
	}
	if transfers {
		q = q.Where("action = ?", "transferred")
	}
	if f.From > 0 {
		q = q.Where("created_at >= ?", f.From)
	}
	if f.To > 0 {
		q = q.Where("created_at <= ?", f.To)
	}
	if f.Query != "" {
		id, _ := strconv.Atoi(f.Query)
		q = q.Where("(user_id = ? OR username = ? OR source = ?)", id, f.Query, f.Query)
	}
	if err := q.Count(&result.Total).Error; err != nil {
		return result, err
	}
	err := q.Order("created_at DESC, id DESC").Limit(f.PageSize).Offset((f.Page - 1) * f.PageSize).Find(&result.Items).Error
	return result, err
}

type InviteReceivedSummary struct {
	Pending       int64  `json:"pending"`
	PendingQuota  int64  `json:"pending_quota"`
	Released      int64  `json:"released"`
	ReleasedQuota int64  `json:"released_quota"`
	CreditedQuota *int64 `json:"credited_quota"`
	OffsetQuota   *int64 `json:"offset_quota"`
	GrossQuota    *int64 `json:"-"`
	Reversed      int64  `json:"reversed"`
}

func getInviteReceived(tx *gorm.DB, userID int) (InviteReceivedSummary, error) {
	var out InviteReceivedSummary
	q := func() *gorm.DB { return tx.Model(&InviteFunding{}).Where("user_id = ? AND reward_quota > 0", userID) }
	if err := q().Where("released_at = 0 AND reward_quota > reversed_quota").Count(&out.Pending).Error; err != nil {
		return out, err
	}
	if err := q().Where("released_at = 0").Select("COALESCE(SUM(reward_quota - reversed_quota),0)").Scan(&out.PendingQuota).Error; err != nil {
		return out, err
	}
	if err := q().Where("released_at > 0").Count(&out.Released).Error; err != nil {
		return out, err
	}
	if err := q().Where("released_at > 0").Select("COALESCE(SUM(reward_quota - reversed_quota),0)").Scan(&out.ReleasedQuota).Error; err != nil {
		return out, err
	}
	if err := q().Where("reversed_quota > 0").Count(&out.Reversed).Error; err != nil {
		return out, err
	}
	var totals struct {
		Count    int64
		Credited int64
		Gross    int64
		Offset   int64 `gorm:"column:debt_offset"`
	}
	if err := tx.Model(&InviteJournal{}).Where("user_id = ? AND role = ? AND action = ?", userID, "invitee", "released").Select("COUNT(*) AS count, COALESCE(SUM(wallet_delta),0) AS credited, COALESCE(SUM(gross),0) AS gross, COALESCE(SUM(debt_offset),0) AS debt_offset").Scan(&totals).Error; err != nil {
		return out, err
	}
	if totals.Count == out.Released {
		out.CreditedQuota = &totals.Credited
		out.OffsetQuota = &totals.Offset
		out.GrossQuota = &totals.Gross
	}
	return out, nil
}
