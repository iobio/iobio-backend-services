#!/bin/bash

aws dynamodb scan --table-name iobio.cache.phenolyzer > dynamo.json
