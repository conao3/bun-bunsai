# bunsai

AWS API をローカルでエミュレートする開発用スタック。LocalStack 相当を Bun (TypeScript) で実装する。

`bunx bunsai` 一発で起動する軽量なローカルスタックを目指す。AWS SDK が内部で持つサービス定義（botocore `service-2.json` / Smithy モデル）をデータとして取り込み、spec 駆動でプロトコル（query / awsJson / rest-json / rest-xml）を処理する。
