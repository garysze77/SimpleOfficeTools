# Receipt Generator API

一個簡單既 Receipt PDF 生成 API，可以比自己既系統接入。

## API Endpoint

```
POST https://your-project.vercel.app/api/receipt
```

## Request Format

```json
{
  "companyName": "ABC Company Limited",
  "companyAddress": "香港中環皇后大道中99號",
  "contactPerson": "John Smith",
  "others": "Tel: 1234-5678 | Email: info@abc.com",
  "themeColor": "#3b82f6",
  "tc": "Payment within 30 days\nGoods sold are not returnable",
  "receipts": [
    {
      "receiptNo": "R001",
      "date": "2024-01-15",
      "clientName": "XYZ Company",
      "clientAddress": "香港灣仔軒尼詩道100號",
      "type": "RECEIPT",
      "items": [
        { "description": "Consulting Services", "qty": 2, "unitCost": 500, "amount": 1000 },
        { "description": "Software License", "qty": 2, "unitCost": 250, "amount": 500 }
      ]
    }
  ]
}
```

## 必要欄位

| 欄位 | 必填 | 說明 |
|------|------|------|
| companyName | ✅ | 公司名稱 |
| receipts | ✅ | 收據陣列 |

## Receipt 物件欄位

| 欄位 | 必填 | 說明 |
|------|------|------|
| receiptNo | ✅ | 收據編號 |
| date | ✅ | 日期 |
| clientName | ✅ | 客戶名稱 |
| items | ✅ | 項目陣列 |
| clientAddress | - | 客戶地址 |
| type | - | 收據類型 (預設: RECEIPT) |

## Item 物件欄位

| 欄位 | 必填 | 說明 |
|------|------|------|
| description | ✅ | 項目說明 |
| qty | ✅ | 數量 |
| unitCost | ✅ | 單價 |
| amount | ✅ | 金額 |

## 部署到 Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

## 示例代碼

### cURL
```bash
curl -X POST https://your-project.vercel.app/api/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "ABC Company",
    "receipts": [{
      "receiptNo": "R001",
      "date": "2024-01-15",
      "clientName": "Client A",
      "items": [{
        "description": "Service",
        "qty": 1,
        "unitCost": 100,
        "amount": 100
      }]
    }]
  }' --output receipt.pdf
```

### JavaScript
```javascript
const response = await fetch('https://your-project.vercel.app/api/receipt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companyName: 'ABC Company',
    receipts: [{
      receiptNo: 'R001',
      date: '2024-01-15',
      clientName: 'Client A',
      items: [{
        description: 'Service',
        qty: 1,
        unitCost: 100,
        amount: 100
      }]
    }]
  })
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
window.open(url);
```
