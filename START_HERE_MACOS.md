# Start here on macOS: run and deploy Stubble Smoke

Follow these steps in order after downloading `stubble-smoke-forecaster-complete.zip`. Commands use macOS Terminal and its default `zsh` shell. They assume your AWS CLI profile is named `default`; if yours has a different name, replace `default` in the commands.

> **Plain-text FIRMS key:** You asked for the NASA FIRMS key to remain open. The `.env` command below writes it in plain text, and this guide repeats it there. The refreshed project ZIP will include this guide, so anyone who receives that ZIP can read the key. Anyone who can read `.env` can read it too. Git ignores `.env`, but if you create another ZIP manually, do not add `.env` to it.

## What you will set up

- **Local development:** the dashboard, DynamoDB Local, SAM's local API, the trained LightGBM model, and SNS alert publishing from your Mac when a forecast crosses the threshold.
- **AWS deployment:** Lambda runs the LightGBM forecast, DynamoDB stores forecasts/history, API Gateway serves the dashboard API, and your existing SNS topic handles email alerts. To give a student account the best chance of deploying successfully, the first deployment leaves hourly scheduling and Bedrock turned off. Manual forecast refresh still works, and the summary tab uses its no-model fallback.

The app uses the Sydney region, `ap-southeast-2`, to match your existing SNS topic: `arn:aws:sns:ap-southeast-2:704660346960:stubble`.

## 1. Install the software

Install these programs if they are not already on your Mac:

1. **Python 3.12.** Use the macOS installer from [python.org](https://www.python.org/downloads/macos/). This project uses native model dependencies, so use a supported Python version.
2. **Node.js 22 LTS.** Install from [nodejs.org](https://nodejs.org/). This gives you `node` and `npm`.
3. **Docker Desktop for Mac.** Install from [Docker Desktop](https://www.docker.com/products/docker-desktop/) and open it. Wait until Docker reports that it is running.
4. **AWS CLI v2.** Install the macOS package using the [AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). You said you have already configured access keys, so do not enter or send them again.
5. **AWS SAM CLI.** Install the macOS package using the [AWS SAM CLI install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). Current AWS instructions require a supported macOS release; check the guide if your Mac is older than macOS 13.[1]

Open a new Terminal window and check the tools:

```zsh
python3.12 --version
node --version
npm --version
docker --version
docker info
aws --version
sam --version
```

`docker info` must finish without a daemon error. If it does not, start Docker Desktop, wait until it is ready, and run `docker info` again. SAM builds this model in a Linux container so its compiled dependencies match Lambda.[2]

## 2. Unzip the project

This assumes the ZIP is in your Downloads folder:

```zsh
mkdir -p "$HOME/stubble-work"
unzip "$HOME/Downloads/stubble-smoke-forecaster-complete.zip" -d "$HOME/stubble-work"
cd "$HOME/stubble-work/stubble-smoke-forecaster"
pwd
ls
```

You should see `template.yaml`, `README.md`, `docker-compose.yml`, and the `src`, `web`, `models`, and `data` folders. **Run project commands from this project root** unless a step tells you to `cd web`.

If `unzip` says it cannot find the file, check the name/path in Finder or run `ls "$HOME/Downloads"` and change the ZIP path above.

## 3. Verify the AWS profile you already configured

List profile names, inspect the `default` profile, and ask AWS who you are:

```zsh
aws configure list-profiles
aws configure list --profile default
aws sts get-caller-identity --profile default
```

`get-caller-identity` should return an account number and an ARN. The account should normally be `704660346960`, because that is the account in your SNS topic ARN. If it is different, pause before deployment: using the topic from another account may require that account's SNS topic policy to allow the Lambda role.

Set this Terminal window to the right profile and region:

```zsh
export AWS_PROFILE=default
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
aws configure set region ap-southeast-2 --profile "$AWS_PROFILE"
aws sts get-caller-identity
```

If your profile has a different name, replace `default` above and later in the guide. Some student labs issue temporary credentials that expire. If `get-caller-identity` reports an expired token, refresh credentials through your lab's official process and check your identity again. Do not try to bypass an AWS account permission error.

Check the existing topic and its email subscribers:

```zsh
TOPIC_ARN='arn:aws:sns:ap-southeast-2:704660346960:stubble'
aws sns get-topic-attributes --topic-arn "$TOPIC_ARN" --region "$AWS_REGION"
aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region "$AWS_REGION" --output table
```

If either command says `AccessDenied`, stop and ask the account/course administrator about that exact permission. A CLI publish you already ran proves your CLI identity could publish at that time. The deployed forecast Lambda is a different identity, and a cross-account topic can also require a topic-policy change.

## 4. Create local settings (plain-text key, as requested)

From the project root, create `.env` as ordinary readable text:

```zsh
cat > .env <<'EOF'
FIRMS_KEY=6c41fe135bbbdeb3b225781b921921e2
SNS_TOPIC_ARN=arn:aws:sns:ap-southeast-2:704660346960:stubble
SNS_REGION=ap-southeast-2
ALERT_THRESHOLD_PM25=150
DDB_ENDPOINT=http://localhost:8000
AWS_DEFAULT_REGION=ap-southeast-2
AWS_PROFILE=default
BEDROCK_MODEL_ID=
EOF
```

This file contains your FIRMS key and settings. It does **not** contain your AWS access keys. The initial PM2.5 threshold is **150 µg/m³**. The app alerts when the 24-hour **or** 48-hour q90 reaches that value. It sends at a low-to-high crossing, avoids repeat messages while forecasts remain high, and resets after a below-threshold forecast. This is the project's default, not a universal health standard. If you later change it, keep `ALERT_THRESHOLD_PM25` and the AWS deployment parameter in agreement.

## 5. Run the project locally first (recommended)

### 5.1 Create a Python environment and start local DynamoDB

From the project root:

```zsh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r src/requirements.txt

docker compose up -d dynamodb-local
docker compose ps
python scripts/init_local_db.py
```

The last command should say it created `StubbleForecasts` at `http://localhost:8000` or that the table already exists. This is a local database in Docker, not your AWS DynamoDB table. Its Docker volume preserves local forecast history when the container restarts.

Keep this Terminal in the project root with `.venv` activated. If you open another Terminal later, activate it again with `cd "$HOME/stubble-work/stubble-smoke-forecaster" && source .venv/bin/activate` before running Python commands.

### 5.2 Build SAM and generate local settings for its containers

Still from the project root:

```zsh
sam build --use-container
python scripts/make_sam_env.py
```

The helper reads `.env` and creates `.aws-sam/env.local.json`, which gives the local API access to the FIRMS key and points its DynamoDB calls at DynamoDB Local. `.aws-sam` is generated/ignored; leave it in place while SAM is running.

### 5.3 Start three local processes

Open **three Terminal windows**. Leave the first two running.

**Terminal 1 — local API:**

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster"
sam local start-api --host 0.0.0.0 --port 3000 --env-vars .aws-sam/env.local.json
```

**Terminal 2 — forecast bridge and model:**

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster"
source .venv/bin/activate
python src/api/local_runner.py
```

This runs the actual trained model on your Mac. It uses the AWS CLI profile from `.env` only if it needs to publish an SNS alert. The Lambda-like local API uses dummy local credentials for DynamoDB Local.

**Terminal 3 — website:**

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster/web"
npm ci
npm run dev
```

Open the local address Vite prints, normally **http://localhost:5175**. Press **Refresh forecast** once and wait a few minutes for the first run; the dashboard polls for the saved forecast. If nothing appears, check the output in Terminals 1 and 2.

The fire map uses live FIRMS data only for dates in its latest five-day window. Other dates use the included October–November archive for 2016–2025 when a matching date exists. The archive does not automatically learn new historical dates.

To stop a running service, press **Control-C** in that Terminal. To stop DynamoDB but keep its saved local data, run `docker compose down` from the project root. To also erase local database history, run `docker compose down -v`; that deletes the local data.

## 6. Confirm the SNS email recipient

The SNS CLI test you already ran showed the topic accepted a message. The email subscriber still needs to be confirmed. Check the list from step 3. If your email is missing, subscribe it:

```zsh
read -r 'EMAIL?Email address to subscribe: '
aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email --notification-endpoint "$EMAIL" --region "$AWS_REGION"
```

Open the email and click **Confirm subscription**. An SNS subscription marked `PendingConfirmation` does not receive messages.[3] Do not create a duplicate if an email is already subscribed and confirmed. A new test publish is sent to **all confirmed subscribers** on this topic, so do not repeat your test unless you want everyone on the topic to receive another test email.

## 7. Build and deploy the backend to AWS

Local testing does not require an AWS deployment. The AWS stack needs your account to permit CloudFormation, Lambda, API Gateway, DynamoDB, IAM role creation/PassRole, and an S3 deployment-artifact bucket. Bedrock and hourly EventBridge scheduling are optional. This first AWS deployment disables those optional pieces to reduce student-account permission problems and avoid hourly runs before you choose to enable them. Manual refresh still works; the summary has a rules-based fallback.

### 7.1 Build the frontend and Lambda packages

Open a Terminal at the project root with Docker running. Export AWS variables again if this is a new Terminal:

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster"
export AWS_PROFILE=default
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
aws sts get-caller-identity

cd web
npm ci
npm run lint
npm run build
cd ..
sam build --use-container
```

Check the size of the built forecast Lambda folder. It contains LightGBM, native libraries and all six trained models:

```zsh
python3 - <<'PY'
from pathlib import Path
folder = Path('.aws-sam/build/ForecastFunction')
size = sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())
print(f'Forecast package: {size / (1024 * 1024):.1f} MiB')
if size >= 250 * 1024 * 1024:
    raise SystemExit('STOP: the forecast package is at/over Lambda’s 250 MiB unzipped limit.')
PY
```

If the check says `STOP`, do not deploy that build. Lambda's ZIP package has a 250 MiB uncompressed limit.[4]

### 7.2 Deploy with Bedrock and automatic scheduling turned off

The AWS stack can only be created if your student account grants the required AWS actions. `CAPABILITY_IAM` acknowledges this template creates Lambda roles; it does **not** bypass account restrictions. `--resolve-s3` lets SAM create/use an S3 bucket for deployment files.[5]

Read the FIRMS key from `.env` into a shell variable and deploy. The first `awk` command reads it without printing it. It is still stored in plain text in `.env`, as you requested.

```zsh
FIRMS_KEY="$(awk -F= '$1 == "FIRMS_KEY" { sub(/^[^=]*=/, ""); print; exit }' .env)"
if [ -z "$FIRMS_KEY" ]; then
  echo 'FIRMS_KEY is missing from .env. Revisit step 4, then rerun this command block.' >&2
else
  TOPIC_ARN='arn:aws:sns:ap-southeast-2:704660346960:stubble'
  sam deploy \
    --stack-name stubble-smoke-forecaster \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --confirm-changeset \
    --parameter-overrides \
      "ParameterKey=FirmsKey,ParameterValue=$FIRMS_KEY" \
      "ParameterKey=SnsTopicArn,ParameterValue=$TOPIC_ARN" \
      "ParameterKey=AlertThresholdPM25,ParameterValue=150" \
      "ParameterKey=EnableBedrockSummary,ParameterValue=false" \
      "ParameterKey=BedrockModelId,ParameterValue=amazon.nova-micro-v1:0" \
      "ParameterKey=AllowedOrigin,ParameterValue=http://localhost:5175" \
      "ParameterKey=EnableHourlySchedule,ParameterValue=false"
fi

unset FIRMS_KEY
```

Read the CloudFormation changeset that SAM displays before accepting it. Confirm it is the `stubble-smoke-forecaster` stack and that the listed resources are the ones you expect. This command does not use `--guided` or `--save-params`, so it will not save the key into `samconfig.toml`.[5]

**If deployment returns `AccessDenied` / `not authorized`, stop.** Bedrock and Scheduler are already off. If the denial names IAM role creation, CloudFormation, Lambda, API Gateway, DynamoDB or S3, your student account may not permit the stack. Do not try to bypass the policy; ask your course/account administrator about that specific action. You can continue using the local setup if it is not allowed.

### 7.3 Get the API URL and generate your first AWS forecast

After `sam deploy` reports success, fetch the API Gateway URL:

```zsh
API_URL="$(aws cloudformation describe-stacks \
  --stack-name stubble-smoke-forecaster \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='ForecastApiUrl'].OutputValue | [0]" \
  --output text)"
printf '%s\n' "$API_URL"
```

It should end with `/prod`. Queue the first forecast:

```zsh
curl --fail-with-body -X POST "$API_URL/refresh" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The response should say that the forecast was queued. The first run fetches weather/fire inputs and executes the six trained models; it can take a few minutes. Poll for the saved result:

```zsh
for attempt in $(seq 1 36); do
  if curl --fail --silent "$API_URL/latest" -o /tmp/stubble-latest.json; then
    echo 'Forecast is ready:'
    python3 -m json.tool /tmp/stubble-latest.json
    break
  fi
  echo "Waiting for forecast ($attempt of 36)..."
  sleep 10
done
```

If the loop finishes without a forecast, check the AWS Console: **CloudWatch → Logs → Log groups**, then open the newest log stream for the forecast Lambda. You can also query saved history:

```zsh
curl --fail "$API_URL/history?limit=10" | python3 -m json.tool
```

### 7.4 Connect the local website to AWS

This points the website running on your Mac at the deployed API. It does **not** publish/upload the website.

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster"
cat > web/.env.local <<EOF
VITE_API_BASE_URL=$API_URL
EOF
cd web
npm run dev
```

If Vite was already running, stop it with Control-C and restart it so it reads `.env.local`. Open **http://localhost:5175**. Try the five tabs: overview, fire activity, forecast trends, season monitor and email alerts. The UI is multilingual and has light/dark controls. The AI-summary fallback works in English, Hindi and Punjabi while Bedrock is disabled.

The API has **no sign-in/authentication**. The configured CORS origin is only `http://localhost:5175`, but CORS is not access control. Do not publish this API for broad public use without adding authentication, especially for `/refresh`, which can invoke a forecast and use AWS resources. Static website hosting is not created by this stack; you are using the local Vite site with the AWS API.

### 7.5 Optional: enable an hourly forecast schedule

The first deployment has no automatic hourly forecast. To enable it, rerun the **entire** `sam deploy` command from step 7.2 with all the same values and change the schedule parameter from `false` to `true`:

```zsh
"ParameterKey=EnableHourlySchedule,ParameterValue=true"
```

Do not run that parameter line by itself. Edit it inside the full deployment command and run the entire command again, including loading `FIRMS_KEY` from `.env`. Do this only if your account allows EventBridge Scheduler and you have checked usage/cost controls. When enabled, the model runs hourly and emails are sent only on threshold crossings. If Scheduler is denied, keep it disabled and use manual refresh.

### 7.6 Optional: enable Amazon Bedrock summaries

The rules-based summary works without Bedrock. If your student account allows Bedrock model invocation in Sydney, rerun the **entire** `sam deploy` command from step 7.2 with the same parameters except this one:

```zsh
"ParameterKey=EnableBedrockSummary,ParameterValue=true"
```

Do not run the parameter line by itself. Edit that value inside the full command and rerun it. The model ID is `amazon.nova-micro-v1:0`. If IAM or model access is denied, redeploy with `EnableBedrockSummary=false`; the fallback remains available. Bedrock calls are pay-per-use and happen only when you request a summary.[6]

## 8. Verify the email-alert path

Email requires all of the following: a confirmed subscriber on the existing SNS topic, the forecast Lambda's SNS permission, a completed forecast run, and a 24-hour or 48-hour q90 at or above **150 µg/m³** after the previous alert state was below the threshold.

The SNS CLI test checks whether the topic accepts a message. It does **not** test the Lambda's forecast threshold logic. Do not lower the threshold just to force an email unless you are willing to notify everyone subscribed to this shared topic. If a real forecast crosses the threshold, check your inbox and forecast Lambda logs. To list the log groups from Terminal:

```zsh
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/stubble-smoke-forecaster \
  --region "$AWS_REGION" --profile "$AWS_PROFILE"
```

The forecast record is still saved if an SNS publish fails; CloudWatch logs record the failure. Check the exact topic ARN and region if the email does not arrive. The SNS recipient must not be `PendingConfirmation`.[3]

## 9. Shut down or remove resources

To stop local processes, press Control-C in each Terminal. Stop local DynamoDB while preserving its volume with:

```zsh
cd "$HOME/stubble-work/stubble-smoke-forecaster"
docker compose down
```

To also erase local DynamoDB's saved history, use `docker compose down -v`. This deletes local data.

To delete the AWS stack when you no longer need it, first export any data you want to keep. This command deletes the stack's DynamoDB table and forecast history. It does not delete your pre-existing SNS topic or its email subscriptions:

```zsh
sam delete --stack-name stubble-smoke-forecaster \
  --region ap-southeast-2 --profile default
```

## Troubleshooting

- **`ExpiredToken`, invalid token or `UnrecognizedClientException`:** refresh temporary student-lab credentials through the official lab process. Then run `aws sts get-caller-identity` again.
- **`AccessDenied` during deploy:** note the denied action and stop. Your account/course administrator must confirm whether that AWS service/action is allowed.
- **Docker connection error:** open Docker Desktop, wait until it is running, then check `docker info`.
- **SAM/LightGBM build error:** use `sam build --use-container` with Docker running. Do not try to build the Lambda's Linux-native libraries directly on macOS.
- **Lambda package size error:** do not deploy if the built forecast package reaches 250 MiB uncompressed. This ZIP-based template does not require ECR; a container-image fallback does and may not be permitted in a student account.[4]
- **No forecast:** request `POST /refresh` once, wait several minutes, then inspect the forecast Lambda's CloudWatch log stream.
- **No map detections:** verify the FIRMS key and date. Live NASA FIRMS covers only the latest five days. Older dates use only included archive records.
- **SNS configured but no email:** confirm the email subscription, topic ARN/region, Lambda publish permissions, and that a q90 actually crossed the threshold.
- **Summary uses fallback:** that is expected while Bedrock is disabled or if the account/model permission is unavailable.
- **Failed CloudFormation stack:** inspect the stack status before deleting or retrying. Removing a stack can delete its DynamoDB table and history; export anything needed first.

## Official references

[1]: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html "Install the AWS SAM CLI"
[2]: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html "AWS SAM build and container builds"
[3]: https://docs.aws.amazon.com/sns/latest/dg/sns-email-notifications.html "Amazon SNS email notifications and subscription confirmation"
[4]: https://docs.aws.amazon.com/lambda/latest/dg/python-package.html "AWS Lambda Python deployment package size limits"
[5]: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html "AWS SAM deploy parameters, capabilities and S3 resolution"
[6]: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html "Amazon Nova Micro model"
[7]: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html "AWS CLI profiles, credentials and region configuration"
