import asyncio
import snowflake.connector


class SnowflakeClient:
    def __init__(self, account: str, username: str, password: str, warehouse: str, database: str, schema: str):
        self.account = account
        self.username = username
        self.password = password
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self._connection = None

    def _get_connection(self):
        if self._connection:
            return self._connection
        self._connection = snowflake.connector.connect(
            account=self.account,
            user=self.username,
            password=self.password,
            warehouse=self.warehouse,
            database=self.database,
            schema=self.schema,
        )
        return self._connection

    async def execute_query(self, query: str, binds: list | None = None) -> list[dict]:
        def _exec():
            conn = self._get_connection()
            cursor = conn.cursor(snowflake.connector.DictCursor)
            cursor.execute(query, binds or [])
            return cursor.fetchall()
        return await asyncio.to_thread(_exec)

    async def describe_table(self, table_name: str) -> list[dict]:
        rows = await self.execute_query(f"DESCRIBE TABLE {table_name}")
        return [
            {
                "name": row.get("name"),
                "type": row.get("type"),
                "nullable": row.get("null?") == "Y",
                "default": row.get("default"),
                "comment": row.get("comment"),
            }
            for row in rows
        ]

    def destroy(self):
        if self._connection:
            self._connection.close()
            self._connection = None
