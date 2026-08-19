const TEACHER_FLOW_FLASH_KEY = 'assessment-v2-teacher-flow-flash'

export function storeTeacherFlowFlash(message) {
  sessionStorage.setItem(TEACHER_FLOW_FLASH_KEY, message)
}

export function readTeacherFlowFlash() {
  const message = sessionStorage.getItem(TEACHER_FLOW_FLASH_KEY) ?? ''
  sessionStorage.removeItem(TEACHER_FLOW_FLASH_KEY)
  return message
}
