function ProtectedRoute({ user, allowedRoles, children, fallback = null }) {
  if (!user) {
    return fallback
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return fallback
  }

  return children
}

export default ProtectedRoute
