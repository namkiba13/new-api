package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestInviteHistoryBothRecipientsPendingRateAndRelease(t *testing.T) {
	inviteLab(t, 24)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 4).Update("inviter_id", 1).Error)
	require.NoError(t, AdminInviteFunding(2, 5000000, "add", "history-b-first-credit-001"))
	require.NoError(t, AdminInviteFunding(4, 10000000, "add", "history-d-first-credit-001"))
	a, err := GetInviteSummary(1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, a.Pending)
	assert.EqualValues(t, 1200000, a.PendingQuota)
	b, err := GetInviteSummary(2)
	require.NoError(t, err)
	assert.EqualValues(t, 1, b.Received.Pending)
	assert.EqualValues(t, 400000, b.Received.PendingQuota)
	assert.Zero(t, b.Pending)
	p, err := GetInviteProgram()
	require.NoError(t, err)
	p.RateBps = 1000
	require.NoError(t, SaveInviteProgram(p))
	require.NoError(t, DB.Create(&User{Id: 5, Username: "history-e", AffCode: "history-e", Status: 1, InviterId: 1}).Error)
	require.NoError(t, AdminInviteFunding(5, 5000000, "add", "history-e-first-credit-001"))
	f := InviteHistoryFilter{Page: 1, PageSize: 20}
	admin, err := GetInviteHistory(0, f)
	require.NoError(t, err)
	require.EqualValues(t, 3, admin.Total)
	for _, row := range admin.Items {
		assert.True(t, row.JournalComplete)
		require.Len(t, row.Recipients, 2)
		for _, recipient := range row.Recipients {
			assert.Nil(t, recipient.NetCredit)
		}
		if row.UserID == 5 {
			assert.Equal(t, 1000, row.RateBps)
		} else {
			assert.Equal(t, 800, row.RateBps)
		}
	}
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+90000))
	a, err = GetInviteSummary(1)
	require.NoError(t, err)
	assert.Zero(t, a.Pending)
	assert.Equal(t, 1700000, a.Balance)
	b, err = GetInviteSummary(2)
	require.NoError(t, err)
	require.NotNil(t, b.Received.CreditedQuota)
	assert.EqualValues(t, 400000, *b.Received.CreditedQuota)
	entries, err := GetInviteJournal(2, "admin:history-b-first-credit-001", false, f)
	require.NoError(t, err)
	require.Len(t, entries.Items, 2)
	for _, entry := range entries.Items {
		assert.Equal(t, 2, entry.UserID)
		assert.Equal(t, "invitee", entry.Role)
		if entry.Action == "released" {
			assert.Equal(t, 5000000, entry.Before.Wallet)
			assert.Equal(t, 5400000, entry.After.Wallet)
			assert.Equal(t, 400000, entry.WalletDelta)
			assert.Zero(t, entry.RewardDelta)
		}
	}
	_, err = TransferInviteRewards(1, 0, "history-transfer-id-0001")
	require.NoError(t, err)
	_, err = TransferInviteRewards(1, 0, "history-transfer-id-0001")
	require.NoError(t, err)
	transfers, err := GetInviteJournal(1, "", true, f)
	require.NoError(t, err)
	require.Len(t, transfers.Items, 1)
	assert.Equal(t, 1700000, transfers.Items[0].WalletDelta)
	assert.Equal(t, -1700000, transfers.Items[0].RewardDelta)
	// Every filter is intersected with authenticated ownership, including OR searches.
	f.Query = "lab-a"
	private, err := GetInviteJournal(2, "admin:history-b-first-credit-001", false, f)
	require.NoError(t, err)
	assert.Empty(t, private.Items)
	f.Query = ""
	f.Role = "invitee"
	privateHistory, err := GetInviteHistory(2, f)
	require.NoError(t, err)
	require.Len(t, privateHistory.Items, 1)
	assert.Empty(t, privateHistory.Items[0].Recipients)
	require.NotNil(t, privateHistory.Items[0].NetCredit)
	assert.Equal(t, 400000, *privateHistory.Items[0].NetCredit)
	f.Query = "lab-d"
	privateHistory, err = GetInviteHistory(2, f)
	require.NoError(t, err)
	assert.Empty(t, privateHistory.Items)
	_, err = GetInviteHistory(1, InviteHistoryFilter{Page: 1, PageSize: 200})
	require.ErrorIs(t, err, ErrInviteRequest)
}

func TestInviteJournalFailureRollsBackMoneyAndCanRetry(t *testing.T) {
	inviteLab(t, 0)
	forced := errors.New("forced journal insertion failure")
	name := "test:invite_journal_failure"
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if tx.Statement.Table == "invite_journals" {
			tx.AddError(forced)
		}
	}))
	t.Cleanup(func() { DB.Callback().Create().Remove(name) })
	require.ErrorIs(t, AdminInviteFunding(2, 10000, "add", "journal-atomic-funding-001"), forced)
	assert.Zero(t, inviteUserState(t, 2).Quota)
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	var count int64
	require.NoError(t, DB.Model(&InviteFunding{}).Count(&count).Error)
	assert.Zero(t, count)
	require.NoError(t, DB.Callback().Create().Remove(name))
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "journal-atomic-funding-001"))
	require.NoError(t, DB.Model(&InviteJournal{}).Count(&count).Error)
	assert.EqualValues(t, 4, count)
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if tx.Statement.Table == "invite_journals" {
			tx.AddError(forced)
		}
	}))
	_, err := TransferInviteRewards(1, 0, "journal-atomic-transfer-01")
	require.ErrorIs(t, err, forced)
	assert.Equal(t, 800, inviteUserState(t, 1).AffQuota)
	assert.Zero(t, inviteUserState(t, 1).Quota)
	require.NoError(t, DB.Callback().Create().Remove(name))
	_, err = TransferInviteRewards(1, 0, "journal-atomic-transfer-01")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&InviteJournal{}).Count(&count).Error)
	assert.EqualValues(t, 5, count)
}

func TestInviteJournalDebtRecoveryAndLegacyUnknown(t *testing.T) {
	inviteLab(t, 0)
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "journal-debt-funding-0001"))
	_, err := TransferInviteRewards(1, 0, "journal-debt-transfer-001")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&User{}).Where("id IN ?", []int{1, 2}).Update("quota", 0).Error)
	require.NoError(t, ReverseInviteRewards("admin:journal-debt-funding-0001", 10000))
	require.NoError(t, ReverseInviteRewards("admin:journal-debt-funding-0001", 10000))
	f := InviteHistoryFilter{Page: 1, PageSize: 20}
	rows, err := GetInviteJournal(1, "admin:journal-debt-funding-0001", false, f)
	require.NoError(t, err)
	require.Len(t, rows.Items, 3)
	assert.Equal(t, "reversed", rows.Items[0].Action)
	assert.Equal(t, 800, rows.Items[0].DebtDelta)
	assert.Zero(t, rows.Items[0].WalletDelta)
	require.NoError(t, DB.Create(&User{Id: 5, Username: "debt-new-referral", AffCode: "debt-new-referral", Status: 1, InviterId: 1}).Error)
	require.NoError(t, AdminInviteFunding(5, 20000, "add", "journal-debt-funding-0002"))
	rows, err = GetInviteJournal(1, "admin:journal-debt-funding-0002", false, f)
	require.NoError(t, err)
	assert.Equal(t, 800, rows.Items[0].Offset)
	assert.Equal(t, 800, rows.Items[0].RewardDelta)
	assert.Equal(t, -800, rows.Items[0].DebtDelta)
	// Simulate a real pre-journal award: keep it visible without fabricating snapshots.
	require.NoError(t, DB.Create(&InviteFunding{Source: "legacy-existing-reward", UserID: 4, InviterID: 1, Quota: 10000, RateBps: 800, RewardQuota: 800, ReleasedAt: 1}).Error)
	f.Query = "legacy-existing-reward"
	history, err := GetInviteHistory(0, f)
	require.NoError(t, err)
	require.Len(t, history.Items, 1)
	assert.False(t, history.Items[0].JournalComplete)
	for _, recipient := range history.Items[0].Recipients {
		assert.Nil(t, recipient.NetCredit)
	}
	summary, err := GetInviteSummary(4)
	require.NoError(t, err)
	assert.Nil(t, summary.Received.CreditedQuota)
	require.NoError(t, DB.Create(&InviteTransfer{ID: "transfer:1:legacy-transfer", UserID: 1, Quota: 123, CreatedAt: 1}).Error)
	require.NoError(t, MigrateInviteRewards(DB))
	require.NoError(t, MigrateInviteRewards(DB))
	f.Query = ""
	oldTransfers, err := GetInviteJournal(1, "", true, f)
	require.NoError(t, err)
	var legacy []InviteJournal
	for _, entry := range oldTransfers.Items {
		if entry.Legacy {
			legacy = append(legacy, entry)
		}
	}
	require.Len(t, legacy, 1)
	assert.Equal(t, 123, legacy[0].WalletDelta)
	assert.Nil(t, legacy[0].Before)
	assert.Nil(t, legacy[0].After)
}

func TestInviteJournalSecondRecipientFailureRollsBackRelease(t *testing.T) {
	inviteLab(t, 24)
	require.NoError(t, AdminInviteFunding(2, 10000, "add", "release-journal-failure-01"))
	forced := errors.New("second recipient journal failed")
	name := "test:second_recipient_journal"
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if entry, ok := tx.Statement.Dest.(*InviteJournal); ok && entry.UserID == 2 && entry.Action == "released" {
			tx.AddError(forced)
		}
	}))
	t.Cleanup(func() { DB.Callback().Create().Remove(name) })
	require.ErrorIs(t, ReleaseInviteRewards(common.GetTimestamp()+90000), forced)
	assert.Zero(t, inviteUserState(t, 1).AffQuota)
	assert.Equal(t, 10000, inviteUserState(t, 2).Quota)
	var count int64
	require.NoError(t, DB.Model(&InviteJournal{}).Count(&count).Error)
	assert.EqualValues(t, 2, count)
	var event InviteFunding
	require.NoError(t, DB.Where("source = ?", "admin:release-journal-failure-01").First(&event).Error)
	assert.Zero(t, event.ReleasedAt)
	require.NoError(t, DB.Callback().Create().Remove(name))
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+90100))
	assert.Equal(t, 800, inviteUserState(t, 1).AffQuota)
	assert.Equal(t, 10800, inviteUserState(t, 2).Quota)
	require.NoError(t, DB.Model(&InviteJournal{}).Count(&count).Error)
	assert.EqualValues(t, 4, count)
}
