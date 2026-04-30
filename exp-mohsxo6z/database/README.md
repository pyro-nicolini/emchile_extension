# Base de Datos

## Módulos Incluidos
- `services`
- `bookings`
- `payments`
- `expenses`
- `clients`
- `quotations`

## Setup

```bash
# Crear la base de datos
createdb mi_restaurante_db

# Ejecutar el schema
psql -d nombre_db -f database/schema.sql
```

## Variables de Entorno

```env
DATABASE_URL=postgresql://user:password@localhost:5432/nombre_db
```
