import { useState, useCallback, useEffect, useRef } from "react";
import { Container, Footer } from "components/layout";
import { Button } from "@chakra-ui/react";
import { useConnection } from "hooks/connection";
import { ControllerError } from "utils/connection";
import { ControllerErrorAlert } from "components/ErrorAlert";
import { Fees } from "./Fees";
import { Funding } from "./Funding";
import { DeployController } from "./DeployController";
import { ErrorCode } from "@cartridge/account-wasm";
import { BigNumberish } from "starknet";
import { BannerProps } from "./layout/Container/Header/Banner";

interface ExecutionContainerProps {
  transactions: any;
  transactionsDetail?: any;
  executionError?: ControllerError;
  onSubmit: (maxFee: BigNumberish) => Promise<void>;
  onDeploy?: () => void;
  onFund?: () => void;
  onError?: (error: ControllerError) => void;
  buttonText?: string;
  hideTxSummary?: boolean;
  children: React.ReactNode;
}

export function ExecutionContainer({
  Icon,
  title,
  description,
  transactions,
  transactionsDetail,
  executionError,
  onSubmit,
  onDeploy,
  onFund,
  onError,
  buttonText = "SUBMIT",
  hideTxSummary = false,
  children,
}: ExecutionContainerProps & BannerProps) {
  const { controller } = useConnection();
  const [maxFee, setMaxFee] = useState<BigNumberish>();
  const [ctrlError, setCtrlError] = useState<ControllerError>(executionError);
  const [isLoading, setIsLoading] = useState(false);
  const [ctaState, setCTAState] = useState<"fund" | "deploy" | "execute">(
    "execute",
  );
  const isEstimated = useRef(false);

  const estimateFees = useCallback(
    async (transactions: any, transactionsDetail?: any) => {
      try {
        const est = await controller.account.estimateInvokeFee(
          transactions,
          transactionsDetail,
        );
        setMaxFee(est.overall_fee);
      } catch (e) {
        const error = {
          code: e.code,
          message: e.message,
          data: e.data ? JSON.parse(e.data) : undefined,
        };
        onError?.(error);
        setCtrlError(error);
      }
    },
    [controller, onError, setCtrlError],
  );

  useEffect(() => {
    if (ctrlError || maxFee) return;

    const estimateFeesAsync = async () => {
      if (isEstimated.current) return;

      isEstimated.current = true;
      await estimateFees(transactions, transactionsDetail);
    };

    estimateFeesAsync();
  }, [ctrlError, maxFee, transactions, transactionsDetail, estimateFees]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSubmit(maxFee);
    } catch (e) {
      const error = {
        code: e.code,
        message: e.message,
        data: e.data ? JSON.parse(e.data) : undefined,
      };
      onError?.(error);
      setCtrlError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setCTAState("execute");
    setCtrlError(undefined);
    setIsLoading(false);
    estimateFees(transactions, transactionsDetail);
  };

  if (
    ctaState === "fund" &&
    ctrlError?.code === ErrorCode.InsufficientBalance
  ) {
    return (
      <Funding
        onComplete={() => {
          resetState();
          onFund?.();
        }}
      />
    );
  }

  if (
    ctaState === "deploy" &&
    ctrlError?.code === ErrorCode.CartridgeControllerNotDeployed
  ) {
    return (
      <DeployController
        onClose={() => {
          resetState();
          onDeploy?.();
        }}
        ctrlError={ctrlError}
      />
    );
  }

  return (
    <Container Icon={Icon} title={title} description={description}>
      {children}
      <Footer hideTxSummary={hideTxSummary}>
        {(() => {
          switch (ctrlError?.code) {
            case ErrorCode.CartridgeControllerNotDeployed:
              return (
                <>
                  <ControllerErrorAlert error={ctrlError} />
                  <Button
                    colorScheme="colorful"
                    onClick={() => setCTAState("deploy")}
                  >
                    DEPLOY ACCOUNT
                  </Button>
                </>
              );
            case ErrorCode.InsufficientBalance:
              return (
                <>
                  {ctrlError ? (
                    <ControllerErrorAlert error={ctrlError} />
                  ) : (
                    <Fees maxFee={BigInt(maxFee)} />
                  )}
                  <Button
                    colorScheme="colorful"
                    onClick={() => setCTAState("fund")}
                  >
                    ADD FUNDS
                  </Button>
                </>
              );
            default:
              return (
                <>
                  {ctrlError && <ControllerErrorAlert error={ctrlError} />}
                  {maxFee && <Fees maxFee={BigInt(maxFee)} />}
                  <Button
                    colorScheme="colorful"
                    onClick={handleSubmit}
                    isLoading={isLoading}
                    isDisabled={!maxFee}
                  >
                    {buttonText}
                  </Button>
                </>
              );
          }
        })()}
      </Footer>
    </Container>
  );
}
