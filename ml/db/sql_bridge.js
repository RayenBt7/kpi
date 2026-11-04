console.log = () => {};
const { poolPromise } = require('../../backend/config/database');

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

async function main() {
  let pool;
  try {
    const rawInput = await readStdin();
    const payload = JSON.parse(rawInput || '{}');
    pool = await poolPromise;

    if (payload.mode === 'query') {
      const result = await pool.request().query(payload.query || '');
      process.stdout.write(JSON.stringify({ ok: true, rows: result.recordset || [] }));
      await pool.close();
      return;
    }

    if (payload.mode === 'batch') {
      await pool.request().batch(payload.sql || '');
      process.stdout.write(JSON.stringify({ ok: true }));
      await pool.close();
      return;
    }

    throw new Error(`Unsupported bridge mode: ${payload.mode}`);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(message);
    process.exit(1);
  } finally {
    if (pool && pool.connected) {
      try {
        await pool.close();
      } catch (closeError) {
        // Ignore pool close failures on short-lived bridge processes.
      }
    }
  }
}

main();
