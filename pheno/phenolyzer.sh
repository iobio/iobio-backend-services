#!/bin/bash

searchTerm=$1

outDir=$(mktemp -d)

perl /phenolyzer/disease_annotation.pl \
    "$searchTerm" \
    -p -ph -logistic \
    -addon_gg DB_MENTHA_GENE_GENE_INTERACTION \
    -addon_gg_weight 0.05 \
    -out $outDir/phenolyzer.out \
    > /dev/null

cat $outDir/phenolyzer.out.final_gene_list

rm -rf $outDir
