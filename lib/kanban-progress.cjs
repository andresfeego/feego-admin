function validProgress(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}
function progressStatus(value) {
  return value === 100 ? 'done' : value === 0 ? 'todo' : 'doing';
}
module.exports = { validProgress, progressStatus };
