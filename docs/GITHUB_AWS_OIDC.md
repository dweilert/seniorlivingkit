# GitHub to AWS OIDC Plan

No AWS OIDC provider, IAM role, or deployment workflow has been deployed in this stage.

## Target Design

- Use GitHub OpenID Connect for short-lived AWS credentials.
- Do not store AWS access keys in GitHub secrets.
- Restrict trust to `repo:dweilert/seniorlivingkit:*`.
- Keep staging and production roles separate.
- Restrict production access to approved branches or GitHub environments.
- Use `permissions: id-token: write` only in deployment jobs that authenticate to AWS.

## Proposed Trust Policy Shape

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:dweilert/seniorlivingkit:ref:refs/heads/main",
            "repo:dweilert/seniorlivingkit:environment:production"
          ]
        }
      }
    }
  ]
}
```

## Proposed Permissions

- Staging role: deploy only staging static hosting, staging backend tables, staging functions, and staging logs.
- Production role: deploy only approved production resources through a protected GitHub environment.
- DNS changes should require a separate explicit approval path and should not be bundled into routine application deployments.
