package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Opt-in: reads a dedicated fixture seeded by the previous RELEASED binary.
// Normal tests use inviteLab and never depend on data from another run.
func TestInviteUpgradeFromReleasedDatabase(t *testing.T) {
	if os.Getenv("INVITE_LAB_UPGRADE") != "1" {
		t.Skip("requires fixture created with released commit c8f08f5")
	}
	oldType := common.MainDatabaseType()
	t.Cleanup(func() { common.SetDatabaseTypes(oldType, oldType); initCol() })
	var d gorm.Dialector
	switch os.Getenv("INVITE_LAB_ENGINE") {
	case "mysql":
		require.Contains(t, os.Getenv("INVITE_LAB_DSN"), "invite_lab")
		d = mysql.Open(os.Getenv("INVITE_LAB_DSN"))
		common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeMySQL)
	case "postgres":
		require.Contains(t, os.Getenv("INVITE_LAB_DSN"), "invite_lab")
		d = postgres.Open(os.Getenv("INVITE_LAB_DSN"))
		common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, common.DatabaseTypePostgreSQL)
	default:
		d = sqlite.Open(filepath.Join(os.TempDir(), "opencode", "invite-journal-upgrade.db"))
		common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	}
	db, err := gorm.Open(d, &gorm.Config{})
	require.NoError(t, err)
	versionQuery := "SELECT VERSION()"
	if db.Dialector.Name() == "sqlite" {
		versionQuery = "SELECT sqlite_version()"
	}
	var version string
	require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
	t.Log("Database:", version)
	oldDB, oldLog := DB, LOG_DB
	DB, LOG_DB = db, db
	initCol()
	conn, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close(); DB, LOG_DB = oldDB, oldLog })
	require.False(t, db.Migrator().HasTable("invite_journals"), "must start with a pre-journal fixture")
	before, err := GetInviteProgram()
	require.NoError(t, err)
	for range 2 {
		require.NoError(t, MigrateInviteRewards(db))
	}
	after, err := GetInviteProgram()
	require.NoError(t, err)
	assert.Equal(t, before, after)
	a := inviteUserState(t, 1)
	b := inviteUserState(t, 2)
	duser := inviteUserState(t, 3)
	assert.Zero(t, a.Quota)
	assert.Zero(t, a.AffQuota)
	assert.Equal(t, 10400, b.Quota)
	assert.Equal(t, 20000, duser.Quota)
	debt, err := inviteDebt(db, 1)
	require.NoError(t, err)
	assert.Equal(t, 400, debt.Quota)
	f := InviteHistoryFilter{Page: 1, PageSize: 20}
	history, err := GetInviteHistory(0, f)
	require.NoError(t, err)
	require.EqualValues(t, 2, history.Total)
	for _, row := range history.Items {
		assert.False(t, row.JournalComplete)
		for _, person := range row.Recipients {
			assert.Nil(t, person.NetCredit)
		}
	}
	journal, err := GetInviteJournal(1, "", true, f)
	require.NoError(t, err)
	require.Len(t, journal.Items, 1)
	assert.True(t, journal.Items[0].Legacy)
	assert.Nil(t, journal.Items[0].Before)
	assert.Equal(t, 800, journal.Items[0].Gross)
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+90000))
	assert.Equal(t, 1200, inviteUserState(t, 1).AffQuota)
	assert.Equal(t, 21600, inviteUserState(t, 3).Quota)
	require.NoError(t, ReleaseInviteRewards(common.GetTimestamp()+90000))
	require.NoError(t, MigrateInviteRewards(db))
	var count int64
	require.NoError(t, db.Model(&InviteJournal{}).Count(&count).Error)
	assert.EqualValues(t, 3, count)
	require.NoError(t, AdminInviteFunding(3, 10000, "add", "upgrade-later-credit0001"))
	assert.Equal(t, 1200, inviteUserState(t, 1).AffQuota)
	assert.Equal(t, 31600, inviteUserState(t, 3).Quota)
}
