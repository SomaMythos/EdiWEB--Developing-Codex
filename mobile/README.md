# EDI Mobile

App mobile MVP em Expo/React Native para consumir o backend atual do EDI.

## Setup

1. Entre em `mobile/`
2. Rode `npm install`
3. Ajuste a URL da API:
   - `mobile/app.json` em `expo.extra.apiUrl`, ou
   - variável `EXPO_PUBLIC_API_URL`
4. Rode `npm start`

## Push notifications

- O app tenta registrar automaticamente um device token depois do login.
- Em simulador, o registro de push fica como indisponivel por design.
- Em aparelho fisico Expo, o token Expo Push e enviado para `/api/notifications/devices`.
- Para token real do Expo, defina o `projectId` do EAS em `app.json`/Expo config quando for preparar producao.

## Observacoes

- Em emulador Android, normalmente use `http://10.0.2.2:8000/api`.
- Em aparelho fisico, use o IP LAN da sua maquina, por exemplo `http://192.168.0.10:8000/api`.
- O backend exige token no header `x-edi-auth-token`.

## Escopo atual

- login
- notificacoes
- dia/atividades
- metas
- financeiro com gasto rapido
- calendario com criacao e edicao basica
- registro automatico de device para push

## Android local build

Se voce quiser testar push real sem depender do EAS cloud, use o build local no Windows:

1. Abra um emulador Android ou conecte um aparelho com depuracao USB.
2. Garanta que `adb` e `java` estejam no PATH.
3. Rode:
   - `D:\Studio\Projects\EdiWEB--Developing\scripts\start_mobile_android_local.bat`

O script:
- verifica se ha dispositivo Android online
- compila e instala o dev client localmente com `expo run:android`
- sobe o backend
- sobe o bundler em modo `dev-client`

Se o app ja estiver instalado e voce quiser pular a recompilacao:
- `powershell -ExecutionPolicy Bypass -File D:\Studio\Projects\EdiWEB--Developing\scripts\start_mobile_android_local.ps1 -SkipBuild`
