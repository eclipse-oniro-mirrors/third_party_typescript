@Builder
declare function builderBare(): void;
@Builder
declare function builderCallForm(): void;
@Builder
declare function builderEmptyCall(): void;
@Component
declare struct BuilderCallFormExample {
    @Builder
    builderMethodBare(): void;
    @Builder
    builderMethodCallForm(): void;
    localBuilderCallForm(): void;
    build(): void;
}
