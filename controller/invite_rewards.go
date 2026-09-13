package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func inviteError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "Could not process invite rewards"
	if errors.Is(err, model.ErrInviteRequest) {
		status = http.StatusBadRequest
		message = "Invalid invite rewards request"
	}
	if errors.Is(err, model.ErrInviteConflict) {
		status = http.StatusConflict
		message = "Invite rewards changed. Reload and try again."
	}
	if errors.Is(err, model.ErrInviteUnavailable) {
		status = http.StatusConflict
		message = "No transferable rewards or outstanding reward recovery"
	}
	if errors.Is(err, model.ErrTopUpQuotaLimitExceeded) || errors.Is(err, model.ErrWalletQuotaLimitExceeded) {
		status = http.StatusConflict
		message = "Wallet balance limit reached"
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		status = http.StatusNotFound
		message = "Invite reward record not found"
	}
	c.JSON(status, gin.H{"success": false, "message": message})
}

func GetInviteRewards(c *gin.Context) {
	data, err := model.GetInviteSummary(c.GetInt("id"))
	if err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func TransferInviteRewards(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	// Identity and the full available amount come from the authenticated account.
	amount, err := model.TransferInviteRewards(c.GetInt("id"), 0, c.GetHeader("Idempotency-Key"))
	if err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"quota": amount}})
}

func GetInviteSettings(c *gin.Context) {
	p, err := model.GetInviteProgram()
	if err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": p})
}

func UpdateInviteSettings(c *gin.Context) {
	var input struct {
		Enabled   *bool  `json:"enabled"`
		Mode      string `json:"mode"`
		RateBps   *int   `json:"rate_bps"`
		HoldHours *int   `json:"hold_hours"`
		Revision  *int   `json:"revision"`
	}
	if err := common.DecodeJson(c.Request.Body, &input); err != nil || input.Enabled == nil || input.RateBps == nil || input.HoldHours == nil || input.Revision == nil {
		inviteError(c, model.ErrInviteRequest)
		return
	}
	if *input.Enabled && !operation_setting.IsPaymentComplianceConfirmed() {
		inviteError(c, model.ErrInviteUnavailable)
		return
	}
	err := model.SaveInviteProgram(model.InviteProgram{Enabled: *input.Enabled, Mode: input.Mode, RateBps: *input.RateBps, HoldHours: *input.HoldHours, Revision: *input.Revision})
	if err != nil {
		inviteError(c, err)
		return
	}
	recordManageAudit(c, "invite.settings.update", map[string]interface{}{"mode": input.Mode, "rate_bps": *input.RateBps, "hold_hours": *input.HoldHours, "enabled": *input.Enabled})
	GetInviteSettings(c)
}

func ListInviteFunding(c *gin.Context) {
	page := common.GetPageQuery(c)
	var rows []model.InviteFunding
	var total int64
	q := model.DB.Model(&model.InviteFunding{})
	if err := q.Count(&total).Error; err != nil {
		inviteError(c, err)
		return
	}
	if err := q.Order("created_at desc, source").Limit(page.GetPageSize()).Offset(page.GetStartIdx()).Find(&rows).Error; err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": rows, "total": total}})
}

func ReverseInviteRewards(c *gin.Context) {
	var input struct {
		Source        string `json:"source"`
		RefundedQuota int    `json:"refunded_quota"`
	}
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		inviteError(c, model.ErrInviteRequest)
		return
	}
	if err := model.ReverseInviteRewards(input.Source, input.RefundedQuota); err != nil {
		inviteError(c, err)
		return
	}
	recordManageAudit(c, "invite.reward.reverse", map[string]interface{}{"source": input.Source, "refunded_quota": input.RefundedQuota})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func inviteHistoryFilter(c *gin.Context) (model.InviteHistoryFilter, error) {
	f := model.InviteHistoryFilter{Role: c.Query("role"), Query: c.Query("q"), SourceKind: c.Query("source_kind"), Status: c.Query("status")}
	var err error
	f.Page, err = strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil {
		return f, model.ErrInviteRequest
	}
	f.PageSize, err = strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil {
		return f, model.ErrInviteRequest
	}
	f.From, err = strconv.ParseInt(c.DefaultQuery("from", "0"), 10, 64)
	if err != nil {
		return f, model.ErrInviteRequest
	}
	f.To, err = strconv.ParseInt(c.DefaultQuery("to", "0"), 10, 64)
	if err != nil || !f.Valid() {
		return f, model.ErrInviteRequest
	}
	return f, nil
}

func GetInviteHistory(c *gin.Context) {
	if c.GetInt("id") <= 0 {
		inviteError(c, model.ErrInviteRequest)
		return
	}
	serveInviteHistory(c, c.GetInt("id"))
}

func AdminInviteHistory(c *gin.Context) { serveInviteHistory(c, 0) }

func serveInviteHistory(c *gin.Context, userID int) {
	f, err := inviteHistoryFilter(c)
	if err != nil {
		inviteError(c, err)
		return
	}
	data, err := model.GetInviteHistory(userID, f)
	if err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func GetInviteJournal(c *gin.Context) {
	if c.GetInt("id") <= 0 {
		inviteError(c, model.ErrInviteRequest)
		return
	}
	serveInviteJournal(c, c.GetInt("id"))
}

func AdminInviteJournal(c *gin.Context) { serveInviteJournal(c, 0) }

func serveInviteJournal(c *gin.Context, userID int) {
	f, err := inviteHistoryFilter(c)
	if err != nil {
		inviteError(c, err)
		return
	}
	data, err := model.GetInviteJournal(userID, c.Query("source"), c.Query("transfers") == "true", f)
	if err != nil {
		inviteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}
