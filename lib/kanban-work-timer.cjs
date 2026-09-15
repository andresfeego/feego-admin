// Append AFTER board/status/progress assignments: MariaDB evaluates single-table
// UPDATE assignments left-to-right. The row lock makes pause/resume atomic.
const running = "(board='kanban' AND status='doing' AND progress_pct<100)";
const elapsed = 'GREATEST(0, TIMESTAMPDIFF(MICROSECOND, work_started_at, UTC_TIMESTAMP(3)) DIV 1000)';
const timerUpdateSql = `, work_elapsed_ms=work_elapsed_ms+CASE WHEN work_started_at IS NOT NULL AND NOT ${running} THEN ${elapsed} ELSE 0 END, work_started_at=CASE WHEN ${running} THEN COALESCE(work_started_at, UTC_TIMESTAMP(3)) ELSE NULL END`;
const timerSelectSql = `, work_elapsed_ms, DATE_FORMAT(work_started_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS work_started_at, work_elapsed_ms+CASE WHEN work_started_at IS NOT NULL THEN ${elapsed} ELSE 0 END AS work_total_ms, DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS work_sampled_at`;
module.exports = { timerUpdateSql, timerSelectSql };
