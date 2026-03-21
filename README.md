# Invoice/Quotation/Receipt Generator

一個簡單既網上工具，可以生成 PDF 收據/發票/報價單。

## 功能 Features

- 📄 支援 Receipt、Invoice、Quotation、Proforma 四種單據類型
- 🎨 4 種 PDF 範本：Classic、Modern、Minimal、Bold
- 🎭 自訂主題顏色 ( Colour Picker)
- 🖼️ 上載公司 Logo
- 💱 多種貨幣支援 (HKD, USD, EUR, GBP, CNY, JPY)
- 📊 Tax/GST 計算 (可自訂税率)
- 💾 設定保存/載入 (localStorage)
- 🌓 Dark Mode 深色模式
- 📤 支援上載 Excel、CSV、JSON 檔案
- 🔗 REST API 接入 (支援中文字)
- 📊 Google Sheets 直接讀取
- 🌍 中英文介面

## 線上使用

訪問: https://your-project.vercel.app

## 本地開發

```bash
# Clone repo
git clone https://github.com/garysze77/SimpleOfficeTools.git
cd SimpleOfficeTools

# Install dependencies
npm install

# Run locally
npx serve .
```

## 部署到 Vercel

```bash
npm i -g vercel
vercel
```

## API Endpoint

```
POST https://your-project.vercel.app/api/receipt
```

**API 完整支援中文字輸出 PDF**

### Request Format

```json
{
  "companyName": "ABC Company Limited",
  "companyAddress": "香港中環皇后大道中99號",
  "contactPerson": "John Smith",
  "others": "Tel: 1234-5678",
  "themeColor": "#3b82f6",
  "template": "classic",
  "currency": "HKD",
  "taxEnabled": false,
  "taxRate": 0,
  "tc": "Payment within 30 days",
  "logoData": "data:image/png;base64,...",
  "receipts": [
    {
      "receiptNo": "R001",
      "date": "2024-01-15",
      "clientName": "XYZ Company",
      "clientAddress": "香港灣仔軒尼詩道100號",
      "type": "RECEIPT",
      "items": [
        { "description": "服務費用", "qty": 1, "unitCost": 100, "amount": 100 }
      ]
    }
  ]
}
```

### Parameters

| 參數 | 必填 | 說明 |
|------|------|------|
| companyName | ✅ | 公司名稱 |
| receipts | ✅ | 收據陣列 |
| receiptNo | ✅ | 收據編號 |
| date | ✅ | 日期 |
| clientName | ✅ | 客戶名稱 |
| items | ✅ | 項目陣列 |
| type | - | 單據類型 (RECEIPT/INVOICE/QUOTATION/PROFORMA) |
| template | - | 範本 (classic/modern/minimal/bold) |
| themeColor | - | 主題顏色 (hex) |
| currency | - | 貨幣 (HKD/USD/EUR/GBP/CNY/JPY) |
| taxEnabled | - | 啟用 Tax (true/false) |
| taxRate | - | 税率 (數字) |
| taxName | - | Tax 名稱 (預設: Tax) |
| companyAddress | - | 公司地址 |
| contactPerson | - | 聯絡人 |
| others | - | 其他資料 |
| logoData | - | Logo (base64) |
| tc | - | Terms & Conditions |

## 示例代碼

### cURL (英文)
```bash
curl -X POST https://your-project.vercel.app/api/receipt \
  -H "Content-Type: application/json" \
  -d '{"companyName":"ABC","receipts":[{"receiptNo":"R001","date":"2024-01-15","clientName":"Client","items":[{"description":"Service","qty":1,"unitCost":100,"amount":100}]}]}' \
  --output receipt.pdf
```

### cURL (中文)
```bash
curl -X POST https://your-project.vercel.app/api/receipt \
  -H "Content-Type: application/json" \
  -d '{"companyName":"測試公司","companyAddress":"香港中環","receipts":[{"receiptNo":"R001","date":"2024-01-15","clientName":"客戶A","clientAddress":"香港灣仔","type":"INVOICE","items":[{"description":"顧問服務","qty":2,"unitCost":500,"amount":1000}]}]}' \
  --output 收據.pdf
```

### JavaScript
```javascript
const res = await fetch('https://your-project.vercel.app/api/receipt', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({
    companyName: 'ABC',
    receipts: [{
      receiptNo: 'R001',
      date: '2024-01-15',
      clientName: 'Client',
      items: [{description:'Test',qty:1,unitCost:100,amount:100}]
    }]
  })
});
const blob = await res.blob();
```

## Excel/CSV/JSON 格式

| 欄位 | 必填 | 說明 |
|------|------|------|
| Receipt_No | ✅ | 收據編號 |
| Date | ✅ | 日期 |
| Client_Name | ✅ | 客戶名稱 |
| Client_Address | - | 客戶地址 |
| Description | ✅ | 項目說明 |
| Unit_Cost | ✅ | 單價 |
| Qty | ✅ | 數量 |
| Amount | ✅ | 金額 |
| Type | - | 單據類型 |

## License

MIT