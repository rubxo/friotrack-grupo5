import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';
const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000';
// This demonstrator must never silently connect to a billable AWS account.
if (!['127.0.0.1','localhost','dynamodb'].includes(new URL(endpoint).hostname)) throw new Error('Solo se permiten endpoints locales en este prototipo.');
export const raw = new DynamoDBClient({ endpoint, region: 'us-east-1', credentials: { accessKeyId: 'localdemo', secretAccessKey: 'localdemo' }, maxAttempts: 5 });
export const db = DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });
const prefix=process.env.TABLE_PREFIX ?? 'Friotrack';
export const tables = { core: prefix+'Core', telemetry: prefix+'TelemetryHot', ops: prefix+'Ops' };
export async function initialize(target=tables) {
  for (const TableName of Object.values(target)) {
    try { await raw.send(new DescribeTableCommand({TableName})); }
    catch (err) {
      if ((err as Error).name!=='ResourceNotFoundException') throw err;
      await raw.send(new CreateTableCommand({TableName,BillingMode:'PAY_PER_REQUEST',
        AttributeDefinitions:[{AttributeName:'PK',AttributeType:'S'},{AttributeName:'SK',AttributeType:'S'},{AttributeName:'GSI1PK',AttributeType:'S'},{AttributeName:'GSI1SK',AttributeType:'S'}],
        KeySchema:[{AttributeName:'PK',KeyType:'HASH'},{AttributeName:'SK',KeyType:'RANGE'}],
        GlobalSecondaryIndexes:[{IndexName:'GSI1',KeySchema:[{AttributeName:'GSI1PK',KeyType:'HASH'},{AttributeName:'GSI1SK',KeyType:'RANGE'}],Projection:{ProjectionType:'ALL'}}]
      }));
      await waitUntilTableExists({client:raw,maxWaitTime:30},{TableName});
    }
  }
}
export async function get(TableName: string, PK: string, SK: string) { return (await db.send(new GetCommand({TableName,Key:{PK,SK},ConsistentRead:true}))).Item; }
export async function put(TableName: string, item: Record<string,unknown>) { await db.send(new PutCommand({TableName,Item:item})); }
export async function queryAll(input: QueryCommandInput) {
  const rows: Record<string,any>[]=[];
  let key: Record<string, any> | undefined;
  do { const page=await db.send(new QueryCommand({...input,ExclusiveStartKey:key})); rows.push(...(page.Items??[])); key=page.LastEvaluatedKey; } while(key);
  return rows;
}
