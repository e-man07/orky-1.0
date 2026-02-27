import snowflake from 'snowflake-sdk'

export class SnowflakeClient {
  private account: string
  private username: string
  private password: string
  private warehouse: string
  private database: string
  private schema: string
  private connection: any | null = null

  constructor(params: {
    account: string
    username: string
    password: string
    warehouse: string
    database: string
    schema: string
  }) {
    this.account = params.account
    this.username = params.username
    this.password = params.password
    this.warehouse = params.warehouse
    this.database = params.database
    this.schema = params.schema
  }

  private async getConnection(): Promise<any> {
    if (this.connection) return this.connection

    return new Promise((resolve, reject) => {
      const conn = snowflake.createConnection({
        account: this.account,
        username: this.username,
        password: this.password,
        warehouse: this.warehouse,
        database: this.database,
        schema: this.schema,
      })

      conn.connect((err: any) => {
        if (err) {
          reject(new Error(`Snowflake connection failed: ${err.message}`))
        } else {
          this.connection = conn
          resolve(conn)
        }
      })
    })
  }

  async executeQuery(query: string, binds?: any[]): Promise<any[]> {
    const conn = await this.getConnection()

    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: query,
        binds: binds || [],
        complete: (err: any, _stmt: any, rows: any[]) => {
          if (err) {
            reject(new Error(`Snowflake query failed: ${err.message}`))
          } else {
            resolve(rows || [])
          }
        },
      })
    })
  }

  async describeTable(tableName: string) {
    const rows = await this.executeQuery(`DESCRIBE TABLE ${tableName}`)
    return rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row['null?'] === 'Y',
      default: row.default,
      comment: row.comment,
    }))
  }

  destroy() {
    if (this.connection) {
      this.connection.destroy(() => {})
      this.connection = null
    }
  }
}
