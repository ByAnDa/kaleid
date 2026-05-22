import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ResolvedTuiTheme } from "../theme/index.js";

export function StatusLine({ status, theme }: { status: string; theme: ResolvedTuiTheme }): React.ReactElement {
  return (
    <Box>
      <Text color={theme.status.warn}>
        <Spinner type="dots" /> {status}
      </Text>
    </Box>
  );
}
