import React from "react";
import { Box, Text } from "ink";

export const HEADER_HEIGHT = 3;

export interface HeaderProps {
  model: string;
  width: number;
}

export function Header({ model, width }: HeaderProps): React.ReactElement {
  const showModel = width >= 42;

  return (
    <Box borderStyle="round" borderColor="cyan" flexShrink={0} height={HEADER_HEIGHT} paddingX={1} width={width}>
      <Text bold color="cyan">
        kaleid
      </Text>
      {showModel ? (
        <>
          <Box flexGrow={1} />
          <Text color="gray">{model}</Text>
        </>
      ) : null}
    </Box>
  );
}
