require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDB() {
  try {
    console.log('⏳ Conectando a Base de Datos para inicializar Schema...');
    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ database/schema.sql no encontrado en', schemaPath);
      process.exit(1);
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Base de datos inicializada correctamente');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fatal inicializando BD:', err.message);
    process.exit(1);
  }
}

initDB();
