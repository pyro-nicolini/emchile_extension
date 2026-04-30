const fastify = require('fastify')({ logger: true });
require('dotenv').config();

fastify.register(require('@fastify/cors'), { origin: '*' });
fastify.register(require('@fastify/jwt'), { secret: process.env.JWT_SECRET || 'secret' });

// Global Error Handler
fastify.setErrorHandler(function (error, request, reply) {
  if (error.name === 'ZodError') {
    reply.status(400).send({ error: 'Validación fallida', details: error.errors });
  } else if (error.code === '23505') {
    reply.status(409).send({ error: 'El registro ya existe' });
  } else {
    this.log.error(error);
    reply.status(500).send({ error: 'Error interno del servidor', details: error.message });
  }
});

fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
fastify.register(require('./routes/health'), { prefix: '/api/health' });
fastify.register(require('./routes/services'), { prefix: '/api/services' });
fastify.register(require('./routes/bookings'), { prefix: '/api/bookings' });
fastify.register(require('./routes/payments'), { prefix: '/api/payments' });
fastify.register(require('./routes/expenses'), { prefix: '/api/expenses' });
fastify.register(require('./routes/clients'), { prefix: '/api/clients' });
fastify.register(require('./routes/quotations'), { prefix: '/api/quotations' });

fastify.listen({ port: process.env.PORT || 4000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Servidor corriendo en ${address}`);
});
