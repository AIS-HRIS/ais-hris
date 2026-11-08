// Reject only exact duplicate active requests; a rejected request may be corrected and resubmitted.
export function duplicateRequest(requests, candidate) {
  return requests.some(item => item.status !== 'rejected' && item.empId === candidate.empId && item.jenis === candidate.jenis && item.tanggalMulai === candidate.tanggalMulai && (item.tanggalSelesai || item.tanggalMulai) === (candidate.tanggalSelesai || candidate.tanggalMulai) && (item.tanggalTukar || '') === (candidate.tanggalTukar || '') && (item.shiftTukar || '') === (candidate.shiftTukar || ''));
}
export function canDecideLeave(actorId, request) {
  if(request.status !== 'pending' || actorId === request.empId) return false;
  return request.group === 'manajemen' ? actorId === 'kurnia' : actorId === 'eri';
}
