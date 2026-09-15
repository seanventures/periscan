import { describe, expect, it } from "vitest";

import { getConnectorByKey, integrationSecretFieldKeys } from "./index.js";
import {
  AWS_INTEGRATION_SECRET_KEYS_BY_AUTH,
  ProwlerAwsCredentialError,
  awsRuntimeCredentialsToEnv,
  awsRuntimeEnvToDockerArgs,
  resolveProwlerAwsRuntimeEnv,
  resolveProwlerModuleInputs
} from "./aws-runtime-credentials.js";
import { encryptIntegrationConfig } from "./integration-credentials.js";

const TEST_ENV = { PERISCAN_INTEGRATION_CREDENTIAL_KEY: "unit-test-key" };
const ACCESS_KEY = "test-aws-access-key";
const SECRET_KEY = "test-aws-secret-key";
const SESSION_TOKEN = "test-aws-session-token";
const TEMP_ACCESS_KEY = "test-temp-access-key";
const TEMP_SECRET_KEY = "test-temp-secret-key";
const TEMP_SESSION_TOKEN = "test-temp-session-token";
const INTEGRATION_ID = "11111111-1111-4111-8111-111111111111";

function connectedAws(
  config: Record<string, unknown>,
  authType = "staticCredentials"
) {
  return {
    authType,
    config,
    product: "AWS",
    status: "Connected",
    vendor: "AWS"
  };
}

describe("Prowler AWS runtime credentials", () => {
  it("uses the same secret keys the AWS connector marks secret", () => {
    const connector = getConnectorByKey("aws");
    expect(connector).toBeTruthy();
    expect(integrationSecretFieldKeys(connector!, "staticCredentials")).toEqual(
      [...AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.staticCredentials]
    );
    expect(integrationSecretFieldKeys(connector!, "assumeRole")).toEqual([
      ...AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.assumeRole
    ]);
  });

  it("maps decrypted static credentials onto AWS process env names", async () => {
    const encrypted = encryptIntegrationConfig(
      {
        accessKeyId: ACCESS_KEY,
        connectorKey: "aws",
        region: "us-east-1",
        secretAccessKey: SECRET_KEY,
        sessionToken: SESSION_TOKEN
      },
      [...AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.staticCredentials],
      TEST_ENV
    );

    expect(encrypted.accessKeyId).not.toBe(ACCESS_KEY);
    expect(encrypted.secretAccessKey).not.toBe(SECRET_KEY);
    expect(encrypted.region).toBe("us-east-1");

    const env = await resolveProwlerAwsRuntimeEnv({
      env: TEST_ENV,
      integration: connectedAws(encrypted)
    });

    expect(env).toEqual({
      AWS_ACCESS_KEY_ID: ACCESS_KEY,
      AWS_DEFAULT_REGION: "us-east-1",
      AWS_REGION: "us-east-1",
      AWS_SECRET_ACCESS_KEY: SECRET_KEY,
      AWS_SESSION_TOKEN: SESSION_TOKEN
    });
    expect(JSON.stringify(encrypted)).not.toContain(SECRET_KEY);
  });

  it("maps AssumeRole temp keys after decrypting the stored role config", async () => {
    const encrypted = encryptIntegrationConfig(
      {
        connectorKey: "aws",
        externalId: "ext-1",
        region: "eu-west-1",
        roleArn: "arn:aws:iam::123456789012:role/periscan-readonly",
        sourceAccessKeyId: ACCESS_KEY,
        sourceSecretAccessKey: SECRET_KEY
      },
      [...AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.assumeRole],
      TEST_ENV
    );

    const env = await resolveProwlerAwsRuntimeEnv({
      assumeRole: async (config) => {
        expect(config.externalId).toBe("ext-1");
        expect(config.roleArn).toBe(
          "arn:aws:iam::123456789012:role/periscan-readonly"
        );
        expect(config.sourceAccessKeyId).toBe(ACCESS_KEY);
        return {
          accessKeyId: TEMP_ACCESS_KEY,
          region: config.region,
          secretAccessKey: TEMP_SECRET_KEY,
          sessionToken: TEMP_SESSION_TOKEN
        };
      },
      env: TEST_ENV,
      integration: connectedAws(encrypted, "assumeRole")
    });

    expect(env).toEqual({
      AWS_ACCESS_KEY_ID: TEMP_ACCESS_KEY,
      AWS_DEFAULT_REGION: "eu-west-1",
      AWS_REGION: "eu-west-1",
      AWS_SECRET_ACCESS_KEY: TEMP_SECRET_KEY,
      AWS_SESSION_TOKEN: TEMP_SESSION_TOKEN
    });
  });

  it("refuses a missing integration without falling back to process env", async () => {
    await expect(
      resolveProwlerAwsRuntimeEnv({ integration: null })
    ).rejects.toBeInstanceOf(ProwlerAwsCredentialError);
    await expect(
      resolveProwlerAwsRuntimeEnv({ integration: null })
    ).rejects.toThrow(/not found/i);
  });

  it("refuses integrations that are not Connected CloudAccount AWS", async () => {
    const encrypted = encryptIntegrationConfig(
      {
        accessKeyId: ACCESS_KEY,
        region: "us-east-1",
        secretAccessKey: SECRET_KEY
      },
      [...AWS_INTEGRATION_SECRET_KEYS_BY_AUTH.staticCredentials],
      TEST_ENV
    );

    await expect(
      resolveProwlerAwsRuntimeEnv({
        env: TEST_ENV,
        integration: {
          ...connectedAws(encrypted),
          status: "Disconnected"
        }
      })
    ).rejects.toThrow(/not a Connected CloudAccount AWS connector/i);

    await expect(
      resolveProwlerAwsRuntimeEnv({
        env: TEST_ENV,
        integration: {
          ...connectedAws(encrypted),
          product: "Bedrock"
        }
      })
    ).rejects.toThrow(/not a Connected CloudAccount AWS connector/i);
  });

  it("returns an honest credential error when decrypt fails", async () => {
    const result = await resolveProwlerModuleInputs({
      env: TEST_ENV,
      integration: connectedAws({
        accessKeyId: "v1.not.a.valid.reference",
        region: "us-east-1",
        secretAccessKey: "v1.also.not.valid.ref"
      }),
      moduleId: "prowler.aws_posture",
      target: { awsIntegrationId: INTEGRATION_ID }
    });

    expect(result.awsRuntimeEnv).toBeUndefined();
    expect(result.awsCredentialError).toMatch(/could not be decrypted/i);
    expect(result.integrationIds).toEqual([INTEGRATION_ID]);
    expect(JSON.stringify(result)).not.toMatch(/v1\.not\.a\.valid/i);
  });

  it("does not resolve credentials for fixture Prowler targets", async () => {
    const result = await resolveProwlerModuleInputs({
      integration: null,
      moduleId: "prowler.aws_posture",
      target: {
        awsIntegrationId: INTEGRATION_ID,
        fixtureMode: true
      }
    });

    expect(result).toEqual({ integrationIds: [] });
  });

  it("inlines AWS env values for Docker instead of reading process env", () => {
    const env = awsRuntimeCredentialsToEnv({
      accessKeyId: ACCESS_KEY,
      region: "us-west-2",
      secretAccessKey: SECRET_KEY
    });
    const args = awsRuntimeEnvToDockerArgs(env);

    expect(args).toEqual([
      "--env",
      `AWS_ACCESS_KEY_ID=${ACCESS_KEY}`,
      "--env",
      `AWS_SECRET_ACCESS_KEY=${SECRET_KEY}`,
      "--env",
      "AWS_REGION=us-west-2",
      "--env",
      "AWS_DEFAULT_REGION=us-west-2"
    ]);
  });
});
