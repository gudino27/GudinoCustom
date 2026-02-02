// Quick script to check invitation tokens in the database
const { getDb } = require('./db-helpers');

async function checkInvitations() {
  try {
    const db = await getDb();

    console.log('\n📋 Recent Invitation Tokens:\n');

    const invitations = await db.all(`
      SELECT
        id,
        email,
        phone,
        full_name,
        role,
        token,
        created_at,
        used_at,
        expires_at
      FROM invitation_tokens
      ORDER BY created_at DESC
      LIMIT 10
    `);

    invitations.forEach((inv, index) => {
      const isExpired = new Date(inv.expires_at) < new Date();
      const isUsed = !!inv.used_at;

      console.log(`${index + 1}. ${inv.full_name} (${inv.role})`);
      console.log(`   Email: ${inv.email || 'N/A'}`);
      console.log(`   Phone: ${inv.phone || 'N/A'}`);
      console.log(`   Token: ${inv.token.substring(0, 20)}...`);
      console.log(`   Created: ${inv.created_at}`);
      console.log(`   Status: ${isUsed ? '✅ USED' : isExpired ? '❌ EXPIRED' : '⏳ PENDING'}`);
      if (isUsed) {
        console.log(`   Used at: ${inv.used_at}`);
      }
      if (isExpired) {
        console.log(`   Expired at: ${inv.expires_at}`);
      }
      console.log('');
    });

    await db.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkInvitations();
