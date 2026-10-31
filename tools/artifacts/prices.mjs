import fs from 'node:fs/promises';
const result=[];
for(const region of ['us-east-1','us-east-2','sa-east-1']){
 const url=`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/${region}/index.json`;
 const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
 const raw=await response.text();await fs.writeFile(`evidence/pricing/dynamodb-${region}.json`,raw);
 const data=JSON.parse(raw);
 for(const [sku,product]of Object.entries(data.products))for(const term of Object.values(data.terms.OnDemand?.[sku]??{}))for(const price of Object.values(term.priceDimensions)){
  result.push({region,sku,usage:product.attributes.usagetype,group:product.attributes.group,description:price.description,unit:price.unit,usd:Number(price.pricePerUnit.USD),begin:price.beginRange,end:price.endRange,effective:term.effectiveDate,url,retrievedAt:new Date().toISOString()});
 }
}
await fs.writeFile('evidence/pricing/dynamodb-prices.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.filter(r=>/WriteRequestUnits|ReadRequestUnits|TimedStorage|PITR|Backup/.test(r.usage)),null,2));
