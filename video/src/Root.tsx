import "./index.css";
import { Composition } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";
import {
  CreditCardDebt,
  creditCardDebtSchema,
} from "./FinanceShort/CreditCardDebt";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CreditCardDebt"
        component={CreditCardDebt}
        durationInFrames={60 * 30}
        fps={30}
        width={1080}
        height={1920}
        schema={creditCardDebtSchema}
        defaultProps={{
          ca: "CA · CHARTERED ACCOUNTANT",
          totalInterest: "£60.9B",
          perAdult: "£1,080",
          apr: "24.4%",
          examplePrincipal: "£5,000",
        }}
      />

      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      />
    </>
  );
};
