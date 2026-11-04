const bcrypt = require('bcryptjs');

// Hash the password 'admin123'
const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    
    console.log('Original password:', password);
    console.log('Hashed password:', hash);
    console.log('\nUse this SQL to create the admin user:');
    console.log(`INSERT INTO users (username, password_hash, isAdmin) VALUES ('admin', '${hash}', 1);`);
});