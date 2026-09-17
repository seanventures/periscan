import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { z } from "zod";

import { isConnectedAwsIntegrationForProwler } from "@periscan/shared";

import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "./integration-credentials.js";

export const PROWLER_AWS_ENV_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_DEFAULT_REGION"
] as const;

export const AWS_INTEGRATION_SECRET_KEYS_BY_AUTH = {
  assumeRole: [
    "externalId",
    "sourceAccessKeyId",
    "sourceSecretAccessKey",
    "sourceSessionToken"
  ],
  staticCredentials: ["accessKeyId", "secretAccessKey", "sessionToken"]
} as const;

const AwsStaticCredentialConfigSchema = z.object({
  accessKeyId: z.string().min(1),
  region: z.string().min(1),
  secretAccessKey: z.string().min(1),
  sessionToken: z.string().min(1).optional()
});

const AwsAssumeRoleConfigSchema = z.object({
  durationSeconds: z.number().int().min(900).max(43200).optional(),
  externalId: z.string().min(1).optional(),
  region: z.string().min(1),
  roleArn: z.string().min(1),
  sessionName: z.string().min(1).optional(),
  sourceAccessKeyId: z.string().min(1).optional(),
  sourceSecretAccessKey: z.string().min(1).optional(),
  sourceSessionToken: z.string().min(1).optional()
});

export type AwsAssumeRoleConfig = z.infer<typeof AwsAssumeRoleConfigSchema>;

export type AwsProwlerRuntimeCredentials = {
  accessKeyId: string;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type ProwlerAwsIntegrationRecord = {
  authType: string;
  config: unknown;
  product: string;
  status: string;
  vendor: string;
};

export class ProwlerAwsCredentialError extends Error {
  readonly code = "aws_integration_unavailable";

  constructor(message: string) {
    super(message);
    this.name = "ProwlerAwsCredentialError";
  }
}

const AWS_SECRET_FIELD_CONNECTOR = {
  manifest: {
    authMethods: [
      {
        fields: AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.staticCredentials.map(
          (key) => ({ key, secret: true })
        ),
        kind: "staticCredentials"
      },
      {
        fields: AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.assumeRole.map((key) => ({
          key,
          secret: true
        })),
        kind: "assumeRole"
      }
    ]
  }
};

export function awsRuntimeCredentialsToEnv(
  credentials: AwsProwlerRuntimeCredentials
): Record<string, string> {
  const env: Record<string, string> = {
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_DEFAULT_REGION: credentials.region,
    AWS_REGION: credentials.region,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey
  };

  if (credentials.sessionToken) {
    env.AWS_SESSION_TOKEN = credentials.sessionToken;
  }

  return env;
}

export function awsRuntimeEnvToDockerArgs(
  env: Record<string, string>
): string[] {
  return PROWLER_AWS_ENV_KEYS.flatMap((key) => {
    const value = env[key];
    return value ? ["--env", `${key}=${value}`] : [];
  });
}

function sourceCredentialsFromAssumeRoleConfig(config: AwsAssumeRoleConfig) {
  if (!config.sourceAccessKeyId || !config.sourceSecretAccessKey) {
    return undefined;
  }

  return {
    accessKeyId: config.sourceAccessKeyId,
    secretAccessKey: config.sourceSecretAccessKey,
    sessionToken: config.sourceSessionToken
  };
}

export async function assumeAwsRoleForProwler(
  config: AwsAssumeRoleConfig,
  integrationId?: string
): Promise<AwsProwlerRuntimeCredentials> {
  const sts = new STSClient({
    credentials: sourceCredentialsFromAssumeRoleConfig(config),
    region: config.region
  });
  const response = await sts.send(
    new AssumeRoleCommand({
      DurationSeconds: config.durationSeconds,
      ExternalId: config.externalId,
      RoleArn: config.roleArn,
      RoleSessionName:
        config.sessionName ??
        `periscan-${(integrationId ?? "prowler").slice(0, 8)}`
    })
  );
  const credentials = response.Credentials;

  if (
    !credentials?.AccessKeyId ||
    !credentials.SecretAccessKey ||
    !credentials.SessionToken
  ) {
    throw new ProwlerAwsCredentialError(
      "AWS AssumeRole response did not include credentials."
    );
  }

  return {
    accessKeyId: credentials.AccessKeyId,
    region: config.region,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken
  };
}

export async function resolveAwsProwlerRuntimeCredentials(
  authType: string,
  decryptedConfig: Record<string, unknown>,
  options: {
    assumeRole?: (
      config: AwsAssumeRoleConfig,
      integrationId?: string
    ) => Promise<AwsProwlerRuntimeCredentials>;
    integrationId?: string;
  } = {}
): Promise<AwsProwlerRuntimeCredentials> {
  if (authType === "assumeRole") {
    const config = AwsAssumeRoleConfigSchema.parse(decryptedConfig);
    const assumeRole = options.assumeRole ?? assumeAwsRoleForProwler;
    return assumeRole(config, options.integrationId);
  }

  if (authType !== "staticCredentials") {
    throw new ProwlerAwsCredentialError(
      "AWS integration is not using stored static credentials or AssumeRole."
    );
  }

  const config = AwsStaticCredentialConfigSchema.parse(decryptedConfig);
  return {
    accessKeyId: config.accessKeyId,
    region: config.region,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken
  };
}

export async function resolveProwlerAwsRuntimeEnv(input: {
  assumeRole?: (
    config: AwsAssumeRoleConfig,
    integrationId?: string
  ) => Promise<AwsProwlerRuntimeCredentials>;
  env?: NodeJS.ProcessEnv;
  integration: ProwlerAwsIntegrationRecord | null;
  integrationId?: string;
}): Promise<Record<string, string>> {
  if (!input.integration) {
    throw new ProwlerAwsCredentialError(
      "AWS integration was not found for this tenant."
    );
  }

  if (!isConnectedAwsIntegrationForProwler(input.integration)) {
    throw new ProwlerAwsCredentialError(
      "AWS integration is not a Connected CloudAccount AWS connector."
    );
  }

  if (input.integration.authType === "mock") {
    throw new ProwlerAwsCredentialError(
      "AWS integration is mock-only; Prowler live execution requires stored credentials."
    );
  }

  const secretKeys = integrationSecretFieldKeys(
    AWS_SECRET_FIELD_CONNECTOR,
    input.integration.authType
  );

  let decrypted: Record<string, unknown>;
  try {
    decrypted = decryptIntegrationConfig(
      input.integration.config,
      secretKeys,
      input.env
    );
  } catch {
    throw new ProwlerAwsCredentialError(
      "AWS integration credentials could not be decrypted."
    );
  }

  try {
    const credentials = await resolveAwsProwlerRuntimeCredentials(
      input.integration.authType,
      decrypted,
      {
        assumeRole: input.assumeRole,
        integrationId: input.integrationId
      }
    );
    return awsRuntimeCredentialsToEnv(credentials);
  } catch (error) {
    if (error instanceof ProwlerAwsCredentialError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw new ProwlerAwsCredentialError(
        "AWS integration config is missing required credential fields."
      );
    }
    throw new ProwlerAwsCredentialError(
      "AWS integration credentials could not be resolved."
    );
  }
}

export function targetRequestsProwlerFixture(
  target: Record<string, unknown>
): boolean {
  return (
    target.fixtureMode === true || typeof target.fixtureReportPath === "string"
  );
}

export function readAwsIntegrationId(
  target: Record<string, unknown>
): string | null {
  const value = target.awsIntegrationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function resolveProwlerModuleInputs(input: {
  assumeRole?: (
    config: AwsAssumeRoleConfig,
    integrationId?: string
  ) => Promise<AwsProwlerRuntimeCredentials>;
  env?: NodeJS.ProcessEnv;
  integration?: ProwlerAwsIntegrationRecord | null;
  moduleId: string;
  target: Record<string, unknown>;
}): Promise<{
  awsCredentialError?: string;
  awsRuntimeEnv?: Record<string, string>;
  integrationIds: string[];
}> {
  if (input.moduleId !== "prowler.aws_posture") {
    return { integrationIds: [] };
  }

  if (targetRequestsProwlerFixture(input.target)) {
    return { integrationIds: [] };
  }

  const awsIntegrationId = readAwsIntegrationId(input.target);
  if (!awsIntegrationId) {
    return { integrationIds: [] };
  }

  try {
    const awsRuntimeEnv = await resolveProwlerAwsRuntimeEnv({
      assumeRole: input.assumeRole,
      env: input.env,
      integration: input.integration ?? null,
      integrationId: awsIntegrationId
    });
    return {
      awsRuntimeEnv,
      integrationIds: [awsIntegrationId]
    };
  } catch (error) {
    const message =
      error instanceof ProwlerAwsCredentialError
        ? error.message
        : "AWS integration credentials could not be resolved.";
    return {
      awsCredentialError: message,
      integrationIds: [awsIntegrationId]
    };
  }
}
