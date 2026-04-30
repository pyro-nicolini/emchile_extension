const db = require('../db');

module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    const { rows } = await db.query('SELECT * FROM services');
    return { data: rows };
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const { rows } = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    if (!rows.length) return reply.status(404).send({ error: 'Recurso no encontrado' });
    return { data: rows[0] };
  });

  fastify.post('/', async (request, reply) => {
    const keys = Object.keys(request.body);
    const values = Object.values(request.body);
    const placeholders = keys.map((_, i) => '$' + (i + 1)).join(', ');
    if (keys.length === 0) return reply.status(400).send({ error: 'Empty body' });
    const query = `INSERT INTO services (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    try {
      const { rows } = await db.query(query, values);
      return reply.status(201).send({ data: rows[0] });
    } catch(e) {
      fastify.log.error(e);
      return reply.status(400).send({ error: e.message });
    }
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const keys = Object.keys(request.body);
    const values = Object.values(request.body);
    if (keys.length === 0) return reply.status(400).send({ error: 'Empty body' });
    const setClause = keys.map((k, i) => k + ' = $' + (i + 1)).join(', ');
    values.push(id);
    const query = `UPDATE services SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    try {
      const { rows } = await db.query(query, values);
      if (!rows.length) return reply.status(404).send({ error: 'Recurso no encontrado' });
      return { data: rows[0] };
    } catch(e) {
      fastify.log.error(e);
      return reply.status(400).send({ error: e.message });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    const { rows } = await db.query('DELETE FROM services WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return reply.status(404).send({ error: 'Recurso no encontrado' });
    return reply.status(204).send();
  });
};
