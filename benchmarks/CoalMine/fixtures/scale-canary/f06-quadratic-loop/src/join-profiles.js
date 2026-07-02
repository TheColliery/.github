// Attaches each user's profile row for the admin export.
// Both arrays come from full-table reads and grow with signups.
function joinProfiles(users, profiles) {
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    profile: profiles.find((p) => p.userId === user.id) || null,
  }));
}

module.exports = { joinProfiles };
