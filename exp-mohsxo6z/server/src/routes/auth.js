const db = require('../db');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Min 6 caracteres'),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

module.exports = async function (fastify, opts) {
  
  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const { rows } = await db.query('SELECT id, email, password_hash, role_id, full_name as name FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) return reply.status(401).send({ error: 'Credenciales inválidas' });
    
    const isValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isValid) return reply.status(401).send({ error: 'Credenciales inválidas' });

    const safeName = user.name || user.email.split('@')[0];
    const roleId = user.role_id || 2;
    
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: roleId }, { expiresIn: '7d' });
    return { token, user: { id: user.id, email: user.email, name: safeName, role: roleId } };
  });

  fastify.post('/register', async (request, reply) => {
    const { email, password, name } = registerSchema.parse(request.body);
    const hash = await bcrypt.hash(password, 10);
    const safeName = name || email.split('@')[0];
    
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash, full_name, is_active) VALUES ($1, $2, $3, true) RETURNING id, email, role_id, full_name as name',
      [email, hash, safeName]
    );
    const newUser = rows[0];
    
    const token = fastify.jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role_id || 2 }, { expiresIn: '7d' });
    return { token, user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role_id || 2 } };
  });

  fastify.get('/me', {
    preValidation: [async (req, reply) => {
      try { await req.jwtVerify(); } catch (err) { reply.send(err); }
    }]
  }, async (request, reply) => {
    const { rows } = await db.query('SELECT id, email, role_id, full_name as name FROM users WHERE id = $1', [request.user.id]);
    if (!rows.length) return reply.status(404).send({ error: 'Usuario no encontrado' });
    
    const u = rows[0];
    return { id: u.id, email: u.email, name: u.name || u.email.split('@')[0], role: u.role_id || 2 };
  });
};
