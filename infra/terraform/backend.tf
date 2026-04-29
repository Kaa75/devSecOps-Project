terraform {
  backend "s3" {
    # TODO: Replace the placeholder values below with your actual backend configuration.
    # Variables cannot be used in backend configuration blocks.
    #
    # bucket         = "<your-project>-terraform-state"   # e.g. "shopcloud-terraform-state"
    # region         = "<your-aws-region>"                # e.g. "eu-west-1"
    # key            = "shopcloud/terraform.tfstate"
    # dynamodb_table = "<your-project>-terraform-locks"   # e.g. "shopcloud-terraform-locks"
    # encrypt        = true

    bucket         = "shopcloud-terraform-state"
    region         = "us-east-1"
    key            = "shopcloud/terraform.tfstate"
    dynamodb_table = "shopcloud-terraform-locks"
    encrypt        = true
  }
}
