const sdkAppendedEncodingGaps: readonly string[] = [
  "SDKAppliedContentEncoding_ec2Query",
  "SDKAppendsGzipAndIgnoresHttpProvidedEncoding_ec2Query",
  "SDKAppendedGzipAfterProvidedEncoding_restJson1",
  "SDKAppendedGzipAfterProvidedEncoding_restXml",
  "SDKAppendsGzipAndIgnoresHttpProvidedEncoding_awsJson1_1",
  "SDKAppendsGzipAndIgnoresHttpProvidedEncoding_awsQuery",
  "SDKAppliedContentEncoding_awsJson1_1",
  "SDKAppliedContentEncoding_awsQuery",
  "SDKAppliedContentEncoding_restJson1",
  "SDKAppliedContentEncoding_restXml",
];

const idempotencyTokenAutoFillGaps: readonly string[] = [
  "Ec2ProtocolIdempotencyTokenAutoFill",
  "QueryIdempotencyTokenAutoFill",
  "QueryProtocolIdempotencyTokenAutoFill",
  "RestJsonQueryIdempotencyTokenAutoFill",
];

const errorCodeAlternateFormatGaps: readonly string[] = [
  "AwsJson11FooErrorUsingCode",
  "AwsJson11FooErrorUsingCodeAndNamespace",
  "AwsJson11FooErrorUsingCodeUriAndNamespace",
  "AwsJson11FooErrorUsingXAmznErrorType",
  "AwsJson11FooErrorUsingXAmznErrorTypeWithUri",
  "AwsJson11FooErrorUsingXAmznErrorTypeWithUriAndNamespace",
  "AwsJson11FooErrorWithDunderTypeAndNamespace",
  "AwsJson11FooErrorWithDunderTypeUriAndNamespace",
  "ComplexError",
  "Ec2ComplexError",
  "InvalidGreetingError",
  "RestJsonComplexErrorWithNoMessage",
  "RestJsonFooErrorUsingCode",
  "RestJsonFooErrorUsingCodeAndNamespace",
  "RestJsonFooErrorUsingCodeUriAndNamespace",
  "RestJsonFooErrorUsingXAmznErrorTypeWithUri",
  "RestJsonFooErrorUsingXAmznErrorTypeWithUriAndNamespace",
  "RestJsonFooErrorWithDunderType",
  "RestJsonFooErrorWithDunderTypeAndNamespace",
  "RestJsonFooErrorWithDunderTypeUriAndNamespace",
];

const clientInputDirectionGaps: readonly string[] = [
  "Ec2QueryNoInputAndOutput:input",
  "InputAndOutputWithTimestampHeaders:input",
  "QueryNoInputAndNoOutput:input",
  "RestJsonInputAndOutputWithTimestampHeaders:input",
  "XmlLists:input",
];

const clientNullHandlingGaps: readonly string[] = [
  "AwsJson11DeserializeIgnoreType",
  "AwsJson11StructuresDontDeserializeNullValues",
  "AwsJson11StructuresDontSerializeNullValues",
  "RestJsonDeserializeIgnoreType",
  "RestJsonDeserializesDenseSetMapAndSkipsNull",
  "RestJsonDoesntDeserializeNullStructureValues",
  "RestJsonDoesntSerializeNullStructureValues",
  "handles_unexpected_json_output",
  "parses_the_request_id_from_the_response",
];

const dateTimeOffsetOutputGaps: readonly string[] = [
  "AwsJson11DateTimeWithNegativeOffset",
  "AwsJson11DateTimeWithPositiveOffset",
  "AwsQueryDateTimeWithNegativeOffset",
  "AwsQueryDateTimeWithPositiveOffset",
  "Ec2QueryDateTimeWithNegativeOffset",
  "Ec2QueryDateTimeWithPositiveOffset",
  "RestJsonDateTimeWithNegativeOffset",
  "RestJsonDateTimeWithPositiveOffset",
  "RestXmlDateTimeWithNegativeOffset",
  "RestXmlDateTimeWithPositiveOffset",
];

const endpointRoutingGaps: readonly string[] = [
  "AwsQueryEndpointTrait",
  "Ec2QueryEndpointTrait",
  "Ec2QueryHostWithPath",
  "QueryHostWithPath",
];

const serverStructuralGaps: readonly string[] = [
  "AwsJson11IntEnums:output",
  "Ec2EmptyQueryLists",
  "Ec2XmlEmptyLists",
  "Ec2XmlNamespaces",
  "IgnoreQueryParamsInResponse",
  "NullAndEmptyHeaders",
  "QueryEmptyQueryMaps",
  "QueryXmlNamespaces",
  "RestJsonHttpPayloadWithUnsetUnion:output",
  "RestJsonHttpWithEmptyStructurePayload",
  "RestJsonHttpWithHeadersButNoPayload",
  "RestJsonNullAndEmptyHeaders",
  "RestJsonOmitsEmptyListQueryValues",
  "RestJsonOmitsNullQuery",
  "RestJsonQueryParamsStringListMap",
  "RestJsonQueryPrecedence",
  "RestXmlHttpPayloadWithUnsetUnion:output",
  "RestXmlOmitsNullQuery",
  "RestXmlQueryParamsStringListMap",
  "RestXmlQueryPrecedence",
  "SimpleScalarPropertiesWithXMLPreamble",
];

export const knownGaps: readonly string[] = [
  ...sdkAppendedEncodingGaps,
  ...idempotencyTokenAutoFillGaps,
  ...errorCodeAlternateFormatGaps,
  ...clientInputDirectionGaps,
  ...clientNullHandlingGaps,
  ...dateTimeOffsetOutputGaps,
  ...endpointRoutingGaps,
  ...serverStructuralGaps,
];
