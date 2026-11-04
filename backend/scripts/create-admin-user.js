const bcrypt = require('bcryptjs');
const sql = require('mssql');
const { poolPromise } = require('../config/database');

const SALT_ROUNDS = 10;

async function createAdminUser() {
  try {
    // Hash the password
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    console.log('Original password:', password);
    console.log('Hashed password:', hashedPassword);
    
    // Connect to database and create admin user
    const pool = await poolPromise;
    
    // First, check if admin user already exists
    const existingResult = await pool.request()
      .input('username', sql.VarChar, 'admin')
      .query('SELECT id FROM users WHERE username = @username');
    
    if (existingResult.recordset.length > 0) {
      console.log('Admin user already exists!');
      return;
    }
    
    // Create the admin user
    const result = await pool.request()
      .input('username', sql.VarChar, 'admin')
      .input('password_hash', sql.VarChar, hashedPassword)
      .input('isAdmin', sql.Bit, true)
      .query(`
        INSERT INTO users (username, password_hash, isAdmin)
        VALUES (@username, @password_hash, @isAdmin);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    console.log('Admin user created successfully!');
    console.log('User ID:', result.recordset[0].id);
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('isAdmin: true');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser();