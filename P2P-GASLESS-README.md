# 🚀 P2P Gasless Payments Plugin - Quick Start

## ¿Qué es esto?

Un plugin para **Hedera Agent Kit** que permite enviar HBAR, tokens y NFTs **SIN PAGAR FEES** (gasless).

### 🎯 Problema que Resuelve

- ❌ Nuevos usuarios no pueden usar blockchain sin tener crypto primero
- ❌ Pagar fees en cada transacción es costoso y complejo
- ❌ Barreras de entrada para adopción masiva

### ✅ Solución

- ✅ **Usuarios**: Envían pagos sin HBAR (fees = $0)
- ✅ **Sponsors**: Pagan fees y cobran comisión pequeña
- ✅ **Ganar-Ganar**: Usuarios no pagan, sponsors ganan

## 🏗️ Arquitectura

```
Usuario (Sin fees) → Firma off-chain → Sponsor paga fees → ✅ Transacción completada
```

**Costo para usuario:** $0
**Costo para sponsor:** ~$0.0003
**Ganancia sponsor:** $0.003-$0.03 (10-100x ROI)

## 📦 Estructura del Proyecto

```
hedera-agent-kit-js/
├── typescript/src/plugins/p2p-plugin/
│   ├── tools/
│   │   ├── create-gasless-payment.ts   # Usuario crea pago
│   │   ├── sign-gasless-payment.ts     # Usuario firma
│   │   ├── relay-gasless-payment.ts    # Sponsor ejecuta
│   │   └── query-gasless-payments.ts   # Consultar estado
│   ├── index.ts                        # Plugin export
│   └── README.md                       # Docs detalladas
│
├── typescript/src/shared/parameter-schemas/
│   └── p2p.zod.ts                      # Schemas de validación
│
└── typescript/examples/langchain/
    ├── p2p-gasless-user.ts             # Ejemplo usuario
    ├── p2p-gasless-sponsor.ts          # Ejemplo sponsor
    ├── .env.p2p.example                # Config ejemplo
    └── P2P-GASLESS-SETUP.md            # Guía completa
```

## ⚡ Quick Start (2 minutos)

### 1. Instalar

```bash
cd typescript/examples/langchain
npm install
```

### 2. Configurar

```bash
cp .env.p2p.example .env
# Editar .env con tus credenciales
```

### 3. Ejecutar

**Como Usuario (enviar sin fees):**
```bash
npx ts-node p2p-gasless-user.ts
```

**Como Sponsor (ganar fees):**
```bash
npx ts-node p2p-gasless-sponsor.ts
```

## 🎮 Uso Básico

### Usuario - Enviar 10 HBAR sin fees

```typescript
import { HederaLangchainToolkit, p2pPlugin } from 'hedera-agent-kit';

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins: [p2pPlugin],
    context: {
      p2pTopicId: process.env.P2P_GASLESS_TOPIC_ID,
    },
  },
});

// El agente hace:
// 1. Crear request de pago
// 2. Firmar off-chain
// 3. Esperar sponsor
// Usuario paga: $0 ✅
```

### Sponsor - Ganar fees

```typescript
// Bot automático que:
// 1. Monitorea pagos firmados
// 2. Los ejecuta
// 3. Cobra comisión

// Ejemplo: 100 pagos/día
// Costo: $0.03
// Ganancia: $3 (fee 1%)
// Profit: $2.97/día = $89/mes
```

## 💰 Modelos de Negocio

### Para Sponsors

| Modelo | Ejemplo | ROI |
|--------|---------|-----|
| **Flat Fee** | 0.01 HBAR/pago | 10x |
| **Percentage** | 1% del monto | 100-1000x |
| **Freemium** | Gratis < 10 HBAR, 0.5% > 10 | Variable |
| **Suscripción** | $5/mes ilimitado | Alto volumen |

### Calculadora

**Volumen:** 100 pagos/día de 10 HBAR c/u
**Fee:** 1%
**Costos:** $0.03/día
**Ingresos:** $3/día
**Profit:** $2.97/día = **$89/mes**

## 🔧 Herramientas Disponibles

### 1. `create_gasless_payment_tool`
Crea request de pago sin ejecutar.

```typescript
{
  paymentType: "hbar_transfer",
  recipientAccountId: "0.0.12345",
  amount: 10,
  memo: "Gasless payment"
}
```

### 2. `sign_gasless_payment_tool`
Firma el pago off-chain (sin fees).

```typescript
{
  paymentRequestId: "abc123",
  topicId: "0.0.67890",
  sequenceNumber: 42
}
```

### 3. `relay_gasless_payment_tool`
Sponsor ejecuta y paga fees.

```typescript
{
  topicId: "0.0.67890",
  sequenceNumber: 43,
  sponsorFee: 0.01  // Tu comisión
}
```

### 4. `query_gasless_payments_tool`
Consulta estado de pagos.

```typescript
{
  topicId: "0.0.67890",
  status: "signed",
  limit: 10
}
```

## 📊 Estados del Pago

```
pending → signed → relayed → completed
                         ↓
                      failed
```

| Estado | Significado |
|--------|-------------|
| `pending` | Creado, esperando firma |
| `signed` | Firmado, esperando sponsor |
| `relayed` | Sponsor procesando |
| `completed` | ✅ Exitoso |
| `failed` | ❌ Error |
| `expired` | ⏰ Expirado |

## 🔒 Seguridad

### Usuarios
- ✅ Firmas off-chain (keys nunca expuestas)
- ✅ Nonces anti-replay
- ✅ Expiración automática
- ✅ Max fee configurable

### Sponsors
- ✅ Validación de firmas
- ✅ Rate limiting
- ✅ Balance checks
- ✅ Fraud detection

## 📚 Documentación Completa

- **Plugin README**: [typescript/src/plugins/p2p-plugin/README.md](typescript/src/plugins/p2p-plugin/README.md)
- **Setup Guide**: [typescript/examples/langchain/P2P-GASLESS-SETUP.md](typescript/examples/langchain/P2P-GASLESS-SETUP.md)
- **Hedera Docs**: https://docs.hedera.com

## 🎯 Casos de Uso

### 1. Onboarding
```typescript
// Dar HBAR a nuevos usuarios SIN que tengan HBAR
await createGaslessPayment({
  recipientAccountId: newUser,
  amount: 10,
  memo: "Welcome bonus"
});
// Nuevo usuario recibe HBAR sin tener HBAR ✅
```

### 2. Micropagos
```typescript
// Tips sin fees
await createGaslessPayment({
  recipientAccountId: creator,
  amount: 0.1,
  memo: "Great content!"
});
// Creador recibe tip, usuario no paga fee ✅
```

### 3. Airdrops
```typescript
// Distribuir tokens gratis
await createGaslessPayment({
  paymentType: "token_transfer",
  tokenId: "0.0.12345",
  amount: 100,
  memo: "Airdrop"
});
// Usuario recibe tokens, no paga ✅
```

## 🐛 Troubleshooting

### "P2P_GASLESS_TOPIC_ID not set"
```bash
# Crear topic
hedera topic create --memo "Gasless"
# Agregar a .env
P2P_GASLESS_TOPIC_ID=0.0.12345
```

### "Insufficient sponsor balance"
```bash
# Fondear cuenta sponsor
# Mínimo: 10 HBAR test
# Recomendado: 100+ HBAR
```

### "No payments found"
```bash
# 1. Crear pago primero (run user example)
# 2. Esperar 5-10 seg (mirrornode delay)
# 3. Verificar topic ID correcto
```

## 💡 Tips

### Maximizar Profit (Sponsors)
1. **Fee óptimo**: 0.5-2% (balance entre volumen y ganancia)
2. **Auto-relay**: Mode automático para capturar todos los pagos
3. **Rate limit**: Evitar spam, max 5-10 por minuto
4. **Monitoreo**: Logs y alertas de balance bajo

### Mejor UX (Usuarios)
1. **Memos claros**: Describir el pago
2. **Expiration**: 1-24 horas (no muy corto, no muy largo)
3. **Check status**: Consultar estado periódicamente
4. **Sponsor confiable**: Usar sponsors conocidos

## 🚀 Producción

### Checklist

- [ ] Topic en mainnet creado
- [ ] Sponsor con 1000+ HBAR
- [ ] Monitoring configurado (DataDog/CloudWatch)
- [ ] Rate limiting activado
- [ ] Backup sponsors
- [ ] Auto-restart en crashes
- [ ] Logging estructurado
- [ ] Alertas de balance bajo

### Recomendaciones

- **Multiple sponsors**: Redundancia para alta disponibilidad
- **Load balancing**: Distribuir entre sponsors
- **Monitoring 24/7**: Uptime crítico
- **Fee dinámico**: Ajustar según demanda

## 🤝 Contribuir

```bash
# Fork repo
git clone https://github.com/hedera-dev/hedera-agent-kit
cd hedera-agent-kit

# Crear branch
git checkout -b feature/my-improvement

# Hacer cambios
# ...

# Commit con DCO
git commit -s -m "Add improvement"

# Push y crear PR
git push origin feature/my-improvement
```

## 📞 Soporte

- **Issues**: https://github.com/hedera-dev/hedera-agent-kit/issues
- **Discord**: https://discord.gg/hedera
- **Docs**: https://docs.hedera.com

## 📄 Licencia

Apache 2.0

---

## 🎉 ¡Empieza Ahora!

### Usuario
```bash
cd typescript/examples/langchain
npx ts-node p2p-gasless-user.ts
# Envía pagos SIN fees ✅
```

### Sponsor
```bash
cd typescript/examples/langchain
npx ts-node p2p-gasless-sponsor.ts
# Gana dinero relaying ✅
```

**¡Feliz P2P Gasless! 🚀**
