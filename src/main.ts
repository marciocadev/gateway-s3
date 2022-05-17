import { App, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AwsIntegration, MethodOptions, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'Bucket', {
      bucketName: 'lazy-gateway-s3',
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const rest = new RestApi(this, 'RestApi', {
      restApiName: 'gateway-s3',
      // field that enables API Gateway to handle binary media types.
      // If the API needs to serve anything other than a text payload, this is required.
      // binaryMediaTypes: ['application/octet-stream', 'image/jpeg'],
      binaryMediaTypes: ['*/*'],
      //  a field that enables compression of your content and specifies
      // the minimum size of payload that has to be compressed
      minimumCompressionSize: 0,
    });

    const resFiles = rest.root.addResource('files');
    const resFolder = resFiles.addResource('{folder}');
    const resFile = resFolder.addResource('{file}');

    const methodOpt:MethodOptions = {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Content-Type': true,
          },
        },
      ],
      requestParameters: {
        'method.request.path.folder': true,
        'method.request.path.file': true,
        'method.request.header.Content-Type': true,
      },
    };
    resFile.addMethod('PUT', this.putIntegration(bucket), methodOpt);
    resFile.addMethod('GET', this.getIntegration(bucket), methodOpt);
    // resFile.addMethod('DELETE', this.deleteIntegration(bucket), methodOpt);
  }

  public deleteIntegration(bucket:IBucket) {
    const deleteRole = new Role(this, 'BucketDeleteRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: 'bucket-delete-role',
    });
    deleteRole.addToPolicy(new PolicyStatement({
      resources: [bucket.bucketArn],
      actions: ['s3:DeleteObject'],
    }));
    bucket.grantDelete(deleteRole);
    return new AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'DELETE',
      path: `${bucket.bucketName}/{folder}/{file}`,
      options: {
        credentialsRole: deleteRole,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            },
          },
        ],
        requestParameters: {
          'integration.request.path.folder': 'method.request.path.folder',
          'integration.request.path.file': 'method.request.path.file',
        },
      },
    });
  }

  private getIntegration(bucket:IBucket) {
    const getRole = new Role(this, 'BucketGetRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: 'bucket-get-role',
    });
    getRole.addToPolicy(new PolicyStatement({
      resources: [bucket.bucketArn],
      actions: ['s3:GetObject'],
    }));
    bucket.grantRead(getRole);
    return new AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'GET',
      path: `${bucket.bucketName}/{folder}/{file}`,
      options: {
        credentialsRole: getRole,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            },
          },
        ],
        requestParameters: {
          'integration.request.path.folder': 'method.request.path.folder',
          'integration.request.path.file': 'method.request.path.file',
        },
      },
    });
  }

  private putIntegration(bucket: IBucket) {
    const putRole = new Role(this, 'BucketPutRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: 'bucket-put-role',
    });
    putRole.addToPolicy(new PolicyStatement({
      resources: [bucket.bucketArn],
      actions: ['s3:PutObject'],
    }));
    bucket.grantWrite(putRole);
    return new AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'PUT',
      path: `${bucket.bucketName}/{folder}/{file}`,
      options: {
        credentialsRole: putRole,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Content-Type': 'integration.response.header.Content-Type',
            },
          },
        ],
        requestParameters: {
          'integration.request.path.folder': 'method.request.path.folder',
          'integration.request.path.file': 'method.request.path.file',
        },
      },
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'gateway-s3-dev', { env: devEnv });
// new MyStack(app, 'gateway-s3-prod', { env: prodEnv });

app.synth();