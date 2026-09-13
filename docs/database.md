# Managing the database

## Dependencies

* <a href="https://www.postgresql.org">PostgreSQL</a></li>
* <a href="https://github.com/porsager/postgres"><code>postgres</code></a> Node driver</li>
* <a href="https://github.com/lukeed/ley"><code>ley</code></a> for migrations

## Postgres CLI cheat sheat
```sudo -i -u postgres psql
\\l # list databases
\\c loom # connect to <code>loom</code>
\\dt # list tables
SELECT count(*) FROM accounts; # any SQL
```

## Postgres setup

Loom is powered by <a href="https://www.postgresql.org">PostgreSQL</a> 15+. We use Docker containers to manage it.

The env configs for the data base are as follows:
```
database = PGDATABASE or 'loom'
username = PGUSERNAME or PGUSER or 'postgres'
password = PGPASSWORD or 'password'
host = PGHOST or 'localhost'
port = PGPORT or 5432
idle_timeout = PGIDLE_TIMEOUT
connect_timeout = PGCONNECT_TIMEOUT`
```

## Creating migrations

Loom server uses <a href="https://github.com/lukeed/ley">Ley</a> to manage its DB migrations. Migration files are located in the
<a href="https://github.com/getloom/loom/tree/main/src/lib/db/migrations">migrations</a> directory. 

To create a new migration file use the `ley new` command (see Ley's docs for more details) Use `npm run db:migrate` to run migrations.

## Creating backups</h3>

The following command makes a backup dump of the default <code>loom</code> table</p>

`sudo -i -u postgres pg_dump loom > backup.sql`

And these commands can restore that dump to the default loom table. Note: you may have to drop and recreate the <code>loom</code> table first
	</p>
`sudo -i -u postgres psql -d loom {'<'} backup.sql`

## Database tasks</h3>

Loom has a number of npm tasks for managing the database.

### TODO npm run db:create

The task <code>npm run db:create</code> creates the database from scratch. It destroys any existing schema
		and data, runs all migrations, and seeds the database.
```
npm run db:create
```

The tasks it composes can be run individually:

* <code>TODO npm run db:destroy</code>
* <code>npm run db:migrate</code>
* <code>TODO npm run db:seed</code>